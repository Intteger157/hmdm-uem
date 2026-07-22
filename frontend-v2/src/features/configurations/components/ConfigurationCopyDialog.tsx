import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCopyConfigurationMutation } from '@/features/configurations/hooks/use-configurations'
import type { Configuration } from '@/features/configurations/api/configurations-api'
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

interface ConfigurationCopyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configuration: Configuration | null
}

export function ConfigurationCopyDialog({
  open,
  onOpenChange,
  configuration,
}: ConfigurationCopyDialogProps) {
  const { t } = useTranslation()
  const copyMutation = useCopyConfigurationMutation()
  const [name, setName] = useState('')

  useEffect(() => {
    if (open && configuration) {
      setName(`${configuration.name} (copy)`)
    }
  }, [open, configuration])

  const handleCopy = async () => {
    if (!configuration?.id || !name.trim()) {
      return
    }

    try {
      await copyMutation.mutateAsync({
        id: configuration.id,
        name: name.trim(),
        description: configuration.description,
      })
      toast.success(t('configurations.copy.success'))
      onOpenChange(false)
    } catch {
      toast.error(t('configurations.copy.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('configurations.copy.title')}</DialogTitle>
          <DialogDescription>
            {t('configurations.copy.description', { name: configuration?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="copy-config-name">{t('configurations.copy.nameLabel')}</Label>
          <Input
            id="copy-config-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>

        <DialogFooter className="border-t-0 bg-transparent p-0 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={copyMutation.isPending || !name.trim()}
            onClick={() => void handleCopy()}
          >
            {copyMutation.isPending ? t('common.saving') : t('configurations.copy.action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
