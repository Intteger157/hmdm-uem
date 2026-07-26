import { useEffect, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { usePowerShellScriptsQuery } from '@/features/windows/scripts/hooks/use-windows-scripts'
import {
  buildPowerShellCommandPayload,
  type PowerShellExecutionContext,
} from '@/features/windows/scripts/types/powershell-script'
import {
  DEFAULT_POWERSHELL_SCRIPT,
  POWERSHELL_SNIPPETS,
} from '@/features/windows/constants/powershell-snippets'

interface WindowsPowerShellDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: string) => void
  isPending?: boolean
}

type ScriptSource = 'custom' | 'library'

export function WindowsPowerShellDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: WindowsPowerShellDialogProps) {
  const { t } = useTranslation()
  const scriptsQuery = usePowerShellScriptsQuery(open)

  const [source, setSource] = useState<ScriptSource>('custom')
  const [selectedLibraryId, setSelectedLibraryId] = useState('')
  const [selectedSnippetId, setSelectedSnippetId] = useState('')
  const [script, setScript] = useState(DEFAULT_POWERSHELL_SCRIPT)
  const [executionContext, setExecutionContext] = useState<PowerShellExecutionContext>('System')

  useEffect(() => {
    if (!open) {
      return
    }
    setSource('custom')
    setSelectedLibraryId('')
    setSelectedSnippetId('')
    setScript(DEFAULT_POWERSHELL_SCRIPT)
    setExecutionContext('System')
  }, [open])

  const handleLibraryChange = (scriptId: string) => {
    setSelectedLibraryId(scriptId)
    setSelectedSnippetId('')
    if (!scriptId) {
      return
    }
    const libraryScript = (scriptsQuery.data ?? []).find((item) => String(item.id) === scriptId)
    if (libraryScript) {
      setScript(libraryScript.content)
      setExecutionContext(libraryScript.executionContext)
    }
  }

  const handleSnippetChange = (snippetId: string) => {
    setSelectedSnippetId(snippetId)
    setSelectedLibraryId('')
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
    if (selectedLibraryId) {
      setSelectedLibraryId('')
      setSource('custom')
    }
    if (selectedSnippetId) {
      setSelectedSnippetId('')
    }
  }

  const handleSubmit = () => {
    const trimmed = script.trim()
    if (!trimmed) {
      return
    }
    onSubmit(buildPowerShellCommandPayload(trimmed, executionContext))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('deviceDetail.actions.powershell')}</DialogTitle>
          <DialogDescription>{t('deviceDetail.actions.powershellModalDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="windows-ps-source">{t('deviceDetail.actions.powershellSource')}</Label>
            <NativeSelect
              id="windows-ps-source"
              value={source}
              disabled={isPending}
              onChange={(event) => {
                const nextSource = event.target.value as ScriptSource
                setSource(nextSource)
                setSelectedLibraryId('')
                setSelectedSnippetId('')
                if (nextSource === 'custom') {
                  setScript(DEFAULT_POWERSHELL_SCRIPT)
                  setExecutionContext('System')
                } else {
                  setScript('')
                }
              }}
            >
              <option value="custom">{t('deviceDetail.actions.powershellSourceCustom')}</option>
              <option value="library">{t('deviceDetail.actions.powershellSourceLibrary')}</option>
            </NativeSelect>
          </div>

          {source === 'library' ? (
            <div className="space-y-2">
              <Label htmlFor="windows-ps-library">{t('deviceDetail.actions.powershellLibraryLabel')}</Label>
              <NativeSelect
                id="windows-ps-library"
                value={selectedLibraryId}
                disabled={isPending || scriptsQuery.isLoading}
                onChange={(event) => handleLibraryChange(event.target.value)}
              >
                <option value="">{t('deviceDetail.actions.powershellLibraryPlaceholder')}</option>
                {(scriptsQuery.data ?? []).map((libraryScript) => (
                  <option key={libraryScript.id} value={String(libraryScript.id)}>
                    {libraryScript.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="windows-ps-snippet">{t('deviceDetail.actions.powershellTemplateLabel')}</Label>
              <NativeSelect
                id="windows-ps-snippet"
                value={selectedSnippetId}
                disabled={isPending}
                onChange={(event) => handleSnippetChange(event.target.value)}
              >
                <option value="">{t('deviceDetail.actions.powershellTemplatePlaceholder')}</option>
                {POWERSHELL_SNIPPETS.map((snippet) => (
                  <option key={snippet.id} value={snippet.id}>
                    {t(snippet.labelKey)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="windows-ps-context">{t('windowsScripts.form.executionContext')}</Label>
            <NativeSelect
              id="windows-ps-context"
              value={executionContext}
              disabled={isPending || (source === 'library' && !!selectedLibraryId)}
              onChange={(event) =>
                setExecutionContext(event.target.value as PowerShellExecutionContext)
              }
            >
              <option value="System">{t('windowsScripts.form.contextSystem')}</option>
              <option value="User">{t('windowsScripts.form.contextUser')}</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="windows-ps-script">{t('deviceDetail.actions.powershellScript')}</Label>
            <Textarea
              id="windows-ps-script"
              value={script}
              onChange={(event) => handleScriptChange(event.target.value)}
              rows={12}
              spellCheck={false}
              className="min-h-[280px] w-full bg-gray-950 p-4 font-mono text-sm text-green-400"
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
