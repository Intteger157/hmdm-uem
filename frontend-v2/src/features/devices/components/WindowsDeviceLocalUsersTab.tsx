import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LocalUser } from '@/shared/api/types/device-detail'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useDeviceDetailCommandToast } from '@/features/devices/context/device-detail-command-toast-context'
import { useWindowsDeviceCommandMutation } from '@/features/windows/hooks/use-windows-device-command'

const SUGGESTED_GROUPS = ['Administrators', 'Remote Desktop Users', 'Users', 'Power Users'] as const

type GroupMembershipAction = 'add' | 'remove'

interface WindowsDeviceLocalUsersTabProps {
  hardwareId: string
  localUsers: LocalUser[]
}

export function WindowsDeviceLocalUsersTab({
  hardwareId,
  localUsers,
}: WindowsDeviceLocalUsersTabProps) {
  const { t } = useTranslation()
  const commandMutation = useWindowsDeviceCommandMutation(hardwareId)
  const { trackActionLogCommand } = useDeviceDetailCommandToast()

  const [selectedUser, setSelectedUser] = useState<LocalUser | null>(null)
  const [groupAction, setGroupAction] = useState<GroupMembershipAction>('add')
  const [groupName, setGroupName] = useState('Administrators')

  const handleOpenManage = (user: LocalUser) => {
    setSelectedUser(user)
    setGroupAction('add')
    setGroupName('Administrators')
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedUser(null)
    }
  }

  const handleSubmit = async () => {
    if (!selectedUser) {
      return
    }

    const group = groupName.trim()
    if (!group) {
      toast.error(t('deviceDetail.users.manageGroups.groupRequired'))
      return
    }

    try {
      const response = await commandMutation.mutateAsync({
        action: 'manage_local_group',
        payload: {
          username: selectedUser.username,
          group,
          action: groupAction,
        },
      })
      if (response.logId) {
        trackActionLogCommand(hardwareId, response.logId)
      }
      toast.success(t('deviceDetail.users.manageGroups.commandQueued'))
      handleDialogOpenChange(false)
    } catch {
      toast.error(t('deviceDetail.users.manageGroups.commandError'))
    }
  }

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.username')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.admin')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.status')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('deviceDetail.users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {localUsers.map((user) => (
                  <tr key={user.username} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{user.username}</td>
                    <td className="px-4 py-2.5">
                      {user.isAdmin ? t('deviceDetail.users.yes') : t('deviceDetail.users.no')}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          user.status === 'active'
                            ? 'default'
                            : user.status === 'locked'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={commandMutation.isPending}
                        onClick={() => handleOpenManage(user)}
                      >
                        <Settings2 className="size-3.5" />
                        {t('deviceDetail.users.manageGroups.manage')}
                      </Button>
                    </td>
                  </tr>
                ))}
                {localUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {t('deviceDetail.users.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={selectedUser != null} onOpenChange={handleDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('deviceDetail.users.manageGroups.title', { username: selectedUser?.username ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('deviceDetail.users.manageGroups.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="local-group-action">{t('deviceDetail.users.manageGroups.action')}</Label>
              <NativeSelect
                id="local-group-action"
                value={groupAction}
                onChange={(event) => setGroupAction(event.target.value as GroupMembershipAction)}
              >
                <option value="add">{t('deviceDetail.users.manageGroups.actionAdd')}</option>
                <option value="remove">{t('deviceDetail.users.manageGroups.actionRemove')}</option>
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="local-group-name">{t('deviceDetail.users.manageGroups.groupName')}</Label>
              <Input
                id="local-group-name"
                list="local-group-suggestions"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder={t('deviceDetail.users.manageGroups.groupPlaceholder')}
              />
              <datalist id="local-group-suggestions">
                {SUGGESTED_GROUPS.map((group) => (
                  <option key={group} value={group} />
                ))}
              </datalist>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" disabled={commandMutation.isPending} onClick={() => void handleSubmit()}>
              {t('deviceDetail.users.manageGroups.sendCommand')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
