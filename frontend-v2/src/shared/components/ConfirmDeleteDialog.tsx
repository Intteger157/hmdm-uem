import type { ReactNode } from 'react'
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
  descriptionClassName?: string
  leadingIcon?: ReactNode
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
  descriptionClassName,
  leadingIcon,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {leadingIcon ? (
              <span className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{leadingIcon}</span>
                <span>{description}</span>
              </span>
            ) : (
              description
            )}
          </DialogDescription>
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
