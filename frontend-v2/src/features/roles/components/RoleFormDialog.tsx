import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RolePermission, UserRole } from '@/features/roles/api/roles-api'
import { useRolePermissionsQuery, useUpsertRoleMutation } from '@/features/roles/hooks/use-roles'
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
import { toast } from 'sonner'

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: UserRole | null
  onSaved?: () => void
}

export function RoleFormDialog({ open, onOpenChange, role, onSaved }: RoleFormDialogProps) {
  const { t } = useTranslation()
  const permissionsQuery = useRolePermissionsQuery()
  const upsertMutation = useUpsertRoleMutation()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? '')
    setDescription(role?.description ?? '')
    setSelectedPermissionIds((role?.permissions ?? []).map((p) => p.id))
  }, [open, role])

  const togglePermission = (permission: RolePermission) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permission.id)
        ? prev.filter((id) => id !== permission.id)
        : [...prev, permission.id]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t('roles.form.nameRequired'))
      return
    }

    try {
      await upsertMutation.mutateAsync({
        id: role?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        permissions: selectedPermissionIds.map((id) => ({ id, name: '' })),
      })
      toast.success(t('roles.form.saved'))
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error(t('roles.form.error'))
    }
  }

  const permissions = permissionsQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {role?.id ? t('roles.form.editTitle') : t('roles.form.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('roles.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-name">{t('roles.form.name')}</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-description">{t('roles.form.descriptionField')}</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t('roles.form.permissions')}</Label>
            <div className="max-h-48 overflow-y-auto rounded-lg border p-3 space-y-2">
              {permissions.map((permission) => (
                <label key={permission.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPermissionIds.includes(permission.id)}
                    onChange={() => togglePermission(permission)}
                  />
                  <span>{permission.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={upsertMutation.isPending} onClick={() => void handleSave()}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
