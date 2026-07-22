import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpsertUserMutation, useUserRolesQuery } from '@/features/users/hooks/use-users'
import type { UserAccount } from '@/features/users/api/users-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { toast } from 'sonner'

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserAccount | null
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = user != null
  const upsertMutation = useUpsertUserMutation()
  const rolesQuery = useUserRolesQuery(open)

  const [login, setLogin] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState<number>(0)

  useEffect(() => {
    if (!open) {
      return
    }

    setLogin(user?.login ?? '')
    setName(user?.name ?? '')
    setEmail(user?.email ?? '')
    setPassword('')
    setRoleId(user?.userRole?.id ?? rolesQuery.data?.[0]?.id ?? 0)
  }, [open, user, rolesQuery.data])

  const roles = rolesQuery.data ?? []
  const canSave = login.trim().length > 0 && roleId > 0 && (isEdit || password.length > 0)

  const handleSave = async () => {
    if (!canSave) {
      return
    }

    const role = roles.find((r) => r.id === roleId)
    if (!role) {
      return
    }

    try {
      await upsertMutation.mutateAsync({
        user: {
          ...user,
          login: login.trim(),
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          userRole: role,
        },
        newPassword: password || undefined,
      })
      toast.success(isEdit ? t('users.form.updated') : t('users.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('users.form.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('users.form.editTitle') : t('users.form.addTitle')}</DialogTitle>
          <DialogDescription>{t('users.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-login">{t('users.form.loginLabel')}</Label>
            <Input
              id="user-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-name">{t('users.form.nameLabel')}</Label>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-email">{t('users.form.emailLabel')}</Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-role">{t('users.form.roleLabel')}</Label>
            <NativeSelect
              id="user-role"
              value={roleId ? String(roleId) : ''}
              disabled={rolesQuery.isLoading || roles.length === 0}
              onChange={(e) => setRoleId(Number(e.target.value))}
            >
              <option value="" disabled>
                {t('users.form.selectRole')}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-password">
              {isEdit ? t('users.form.newPasswordLabel') : t('users.form.passwordLabel')}
            </Label>
            <Input
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={upsertMutation.isPending || !canSave}
            onClick={() => void handleSave()}
          >
            {upsertMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
