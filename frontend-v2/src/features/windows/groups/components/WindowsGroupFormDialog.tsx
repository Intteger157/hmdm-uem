import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useCreateWindowsGroupMutation,
  useUpdateWindowsGroupMutation,
} from '@/features/windows/groups/hooks/use-windows-groups'
import type { WindowsGroup } from '@/features/windows/groups/types/windows-group'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface WindowsGroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: WindowsGroup | null
}

export function WindowsGroupFormDialog({ open, onOpenChange, group }: WindowsGroupFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = group != null
  const createMutation = useCreateWindowsGroupMutation()
  const updateMutation = useUpdateWindowsGroupMutation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName(group?.name ?? '')
      setDescription(group?.description ?? '')
    }
  }, [open, group])

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const payload = {
      name: trimmedName,
      description: description.trim() || undefined,
    }

    try {
      if (isEdit && group) {
        await updateMutation.mutateAsync({ id: group.id, payload })
        toast.success(t('windowsGroups.form.updated'))
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(t('windowsGroups.form.created'))
      }
      onOpenChange(false)
    } catch {
      toast.error(t('windowsGroups.form.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#111] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('windowsGroups.form.editTitle') : t('windowsGroups.form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('windowsGroups.form.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="windows-group-name">{t('windowsGroups.form.nameLabel')}</Label>
            <Input
              id="windows-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              className="border-white/10 bg-black/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="windows-group-description">{t('windowsGroups.form.descriptionLabel')}</Label>
            <Textarea
              id="windows-group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="border-white/10 bg-black/20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={isPending || !name.trim()} onClick={() => void handleSave()}>
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
