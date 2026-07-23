import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface WindowsPowerShellDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (script: string) => void
  isPending?: boolean
}

export function WindowsPowerShellDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: WindowsPowerShellDialogProps) {
  const { t } = useTranslation()
  const [script, setScript] = useState('Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture')

  const handleSubmit = () => {
    const trimmed = script.trim()
    if (!trimmed) {
      return
    }
    onSubmit(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('deviceDetail.actions.powershell')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.actions.powershellModalDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="windows-ps-script">{t('deviceDetail.actions.powershellScript')}</Label>
          <Textarea
            id="windows-ps-script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={10}
            className="font-mono text-sm w-full bg-muted/50"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !script.trim()}>
            {t('deviceDetail.actions.powershellExecute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface WindowsInstallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (url: string) => void
  isPending?: boolean
}

export function WindowsInstallDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: WindowsInstallDialogProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')

  const handleSubmit = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      return
    }
    onSubmit(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deviceDetail.actions.install')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.actions.installDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="windows-install-url">{t('deviceDetail.actions.installUrl')}</Label>
          <Input
            id="windows-install-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/installer.exe"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isPending || !url.trim()}>
            {t('deviceDetail.actions.run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
