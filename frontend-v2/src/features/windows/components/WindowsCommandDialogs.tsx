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
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_POWERSHELL_SCRIPT,
  POWERSHELL_SNIPPETS,
} from '@/features/windows/constants/powershell-snippets'

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
  const [script, setScript] = useState(DEFAULT_POWERSHELL_SCRIPT)
  const [selectedSnippetId, setSelectedSnippetId] = useState('')

  const handleSnippetChange = (snippetId: string) => {
    setSelectedSnippetId(snippetId)
    if (!snippetId) {
      return
    }
    const snippet = POWERSHELL_SNIPPETS.find((item) => item.id === snippetId)
    if (snippet) {
      setScript(snippet.script)
    }
  }

  const handleScriptChange = (value: string) => {
    setScript(value)
    if (selectedSnippetId) {
      setSelectedSnippetId('')
    }
  }

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
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="windows-ps-snippet">{t('deviceDetail.actions.powershellTemplateLabel')}</Label>
            <NativeSelect
              id="windows-ps-snippet"
              value={selectedSnippetId}
              onChange={(e) => handleSnippetChange(e.target.value)}
              disabled={isPending}
            >
              <option value="">{t('deviceDetail.actions.powershellTemplatePlaceholder')}</option>
              {POWERSHELL_SNIPPETS.map((snippet) => (
                <option key={snippet.id} value={snippet.id}>
                  {t(snippet.labelKey)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="windows-ps-script">{t('deviceDetail.actions.powershellScript')}</Label>
            <Textarea
              id="windows-ps-script"
              value={script}
              onChange={(e) => handleScriptChange(e.target.value)}
              rows={10}
              className="font-mono text-sm w-full bg-muted/50"
            />
          </div>
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
