import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUpsertGroupMutation } from '@/features/groups/hooks/use-groups'
import type { DeviceGroup } from '@/features/groups/api/groups-api'
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

interface GroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: DeviceGroup | null
}

export function GroupFormDialog({ open, onOpenChange, group }: GroupFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = group != null
  const upsertMutation = useUpsertGroupMutation()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
    }
  }, [open, group])

  const handleSave = async () => {
    if (!name.trim()) {
      return
    }

    try {
      await upsertMutation.mutateAsync({ ...group, name: name.trim() })
      toast.success(isEdit ? t('groups.form.updated') : t('groups.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('groups.form.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('groups.form.editTitle') : t('groups.form.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('groups.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="group-name">{t('groups.form.nameLabel')}</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={upsertMutation.isPending || !name.trim()}
            onClick={() => void handleSave()}
          >
            {upsertMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
