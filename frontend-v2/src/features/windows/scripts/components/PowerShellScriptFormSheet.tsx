import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  POWERSHELL_SCRIPT_PRESETS,
  type PowerShellExecutionContext,
  type PowerShellScript,
} from '@/features/windows/scripts/types/powershell-script'
import {
  useCreatePowerShellScriptMutation,
  useUpdatePowerShellScriptMutation,
} from '@/features/windows/scripts/hooks/use-windows-scripts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface PowerShellScriptFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  script?: PowerShellScript | null
}

const emptyForm = {
  name: '',
  description: '',
  content: '',
  executionContext: 'System' as PowerShellExecutionContext,
}

export function PowerShellScriptFormSheet({
  open,
  onOpenChange,
  script,
}: PowerShellScriptFormSheetProps) {
  const { t } = useTranslation()
  const createMutation = useCreatePowerShellScriptMutation()
  const updateMutation = useUpdatePowerShellScriptMutation()
  const isEdit = script != null

  const [name, setName] = useState(emptyForm.name)
  const [description, setDescription] = useState(emptyForm.description)
  const [content, setContent] = useState(emptyForm.content)
  const [executionContext, setExecutionContext] = useState<PowerShellExecutionContext>(
    emptyForm.executionContext,
  )
  const [selectedPresetId, setSelectedPresetId] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }
    if (script) {
      setName(script.name)
      setDescription(script.description)
      setContent(script.content)
      setExecutionContext(script.executionContext)
    } else {
      setName(emptyForm.name)
      setDescription(emptyForm.description)
      setContent(emptyForm.content)
      setExecutionContext(emptyForm.executionContext)
    }
    setSelectedPresetId('')
  }, [open, script])

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    if (!presetId) {
      return
    }
    const preset = POWERSHELL_SCRIPT_PRESETS.find((item) => item.id === presetId)
    if (!preset) {
      return
    }
    setName(preset.name)
    setDescription(preset.description)
    setContent(preset.content)
    setExecutionContext(preset.executionContext)
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    const trimmedContent = content.trim()
    if (!trimmedName || !trimmedContent) {
      toast.error(t('windowsScripts.form.validation'))
      return
    }

    const payload = {
      name: trimmedName,
      description: description.trim(),
      content: trimmedContent,
      executionContext,
    }

    try {
      if (isEdit && script) {
        await updateMutation.mutateAsync({ id: script.id, payload })
        toast.success(t('windowsScripts.form.updated'))
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(t('windowsScripts.form.created'))
      }
      onOpenChange(false)
    } catch {
      toast.error(t('windowsScripts.form.error'))
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('windowsScripts.form.editTitle') : t('windowsScripts.form.createTitle')}
          </SheetTitle>
          <SheetDescription>{t('windowsScripts.form.description')}</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {!isEdit ? (
            <div className="space-y-2">
              <Label htmlFor="ps-template">{t('windowsScripts.form.loadTemplate')}</Label>
              <NativeSelect
                id="ps-template"
                value={selectedPresetId}
                disabled={isPending}
                onChange={(event) => handlePresetChange(event.target.value)}
              >
                <option value="">{t('windowsScripts.form.loadTemplatePlaceholder')}</option>
                {POWERSHELL_SCRIPT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="ps-name">{t('windowsScripts.form.name')}</Label>
            <Input
              id="ps-name"
              value={name}
              disabled={isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-description">{t('windowsScripts.form.descriptionField')}</Label>
            <Textarea
              id="ps-description"
              value={description}
              rows={2}
              disabled={isPending}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-context">{t('windowsScripts.form.executionContext')}</Label>
            <NativeSelect
              id="ps-context"
              value={executionContext}
              disabled={isPending}
              onChange={(event) =>
                setExecutionContext(event.target.value as PowerShellExecutionContext)
              }
            >
              <option value="System">{t('windowsScripts.form.contextSystem')}</option>
              <option value="User">{t('windowsScripts.form.contextUser')}</option>
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-content">{t('windowsScripts.form.content')}</Label>
            <Textarea
              id="ps-content"
              value={content}
              rows={14}
              disabled={isPending}
              spellCheck={false}
              className="min-h-[300px] w-full bg-gray-950 p-4 font-mono text-sm text-green-400"
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={isPending || !name.trim() || !content.trim()} onClick={() => void handleSubmit()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isEdit ? t('common.save') : t('common.add')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
