import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApplicationConfigurationLink } from '@/features/applications/api/applications-api'
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

interface ApplicationConfigurationDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configurationName?: string
  link: ApplicationConfigurationLink | null
  onSave: (link: ApplicationConfigurationLink) => void
}

export function ApplicationConfigurationDetailsDialog({
  open,
  onOpenChange,
  configurationName,
  link,
  onSave,
}: ApplicationConfigurationDetailsDialogProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ApplicationConfigurationLink | null>(null)

  useEffect(() => {
    if (open && link) {
      setDraft({ ...link })
    }
  }, [open, link])

  if (!draft) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{configurationName ?? draft.configurationName}</DialogTitle>
          <DialogDescription>{t('configurations.editor.appDetails.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link-keycode">{t('configurations.editor.appDetails.keyCode')}</Label>
            <Input
              id="link-keycode"
              value={draft.keyCode != null ? String(draft.keyCode) : ''}
              onChange={(e) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        keyCode: e.target.value.trim() === '' ? undefined : Number(e.target.value),
                        notify: true,
                      }
                    : prev
                )
              }
            />
          </div>

          <BoolField
            id="link-bottom"
            label={t('configurations.editor.appDetails.bottom')}
            checked={draft.bottom === true}
            onCheckedChange={(checked) =>
              setDraft((prev) => (prev ? { ...prev, bottom: checked, notify: true } : prev))
            }
          />

          <BoolField
            id="link-long-tap"
            label={t('configurations.editor.appDetails.longTap')}
            checked={draft.longTap === true}
            onCheckedChange={(checked) =>
              setDraft((prev) => (prev ? { ...prev, longTap: checked, notify: true } : prev))
            }
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
