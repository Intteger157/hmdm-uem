import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  isPending?: boolean
  confirmLabel?: string
  pendingLabel?: string
  confirmVariant?: 'default' | 'destructive'
  onConfirm: () => void
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  confirmLabel,
  pendingLabel,
  confirmVariant = 'destructive',
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending
              ? (pendingLabel ?? t('common.deleting'))
              : (confirmLabel ?? t('common.delete'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
