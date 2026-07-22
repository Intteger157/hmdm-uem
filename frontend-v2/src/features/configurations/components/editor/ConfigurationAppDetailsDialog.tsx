import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { BoolField } from '@/shared/components/BoolField'
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

interface ConfigurationAppDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  application: ConfigurationApplication | null
  onSave: (application: ConfigurationApplication) => void
}

export function ConfigurationAppDetailsDialog({
  open,
  onOpenChange,
  application,
  onSave,
}: ConfigurationAppDetailsDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ConfigurationApplication | null>(null)

  useEffect(() => {
    if (open && application) {
      setDraft({ ...application })
    }
  }, [open, application])

  const handleClose = () => {
    if (draft) {
      onSave(draft)
    }
    onOpenChange(false)
  }

  if (!draft) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{draft.name}</DialogTitle>
          <DialogDescription>{t('configurations.editor.appDetails.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-keycode">{t('configurations.editor.appDetails.keyCode')}</Label>
            <Input
              id="app-keycode"
              value={draft.keyCode != null ? String(draft.keyCode) : ''}
              onChange={(e) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        keyCode: e.target.value.trim() === '' ? undefined : Number(e.target.value),
                      }
                    : prev
                )
              }
            />
          </div>

          <BoolField
            id="app-bottom"
            label={t('configurations.editor.appDetails.bottom')}
            checked={draft.bottom === true}
            onCheckedChange={(checked) =>
              setDraft((prev) => (prev ? { ...prev, bottom: checked } : prev))
            }
          />

          <BoolField
            id="app-long-tap"
            label={t('configurations.editor.appDetails.longTap')}
            checked={draft.longTap === true}
            onCheckedChange={(checked) =>
              setDraft((prev) => (prev ? { ...prev, longTap: checked } : prev))
            }
          />
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleClose}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
