import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileFileDeploymentRule } from '@/features/windows/files/types/stored-file'
import type { StoredFile } from '@/features/windows/files/types/stored-file'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface WindowsProfileFileDeploymentsEditorProps {
  files: StoredFile[]
  rules: ProfileFileDeploymentRule[]
  onChange: (rules: ProfileFileDeploymentRule[]) => void
  disabled?: boolean
}

function createEmptyRule(): ProfileFileDeploymentRule {
  return {
    fileId: 0,
    destinationPath: '',
    unzip: false,
    postActionScript: '',
  }
}

export function WindowsProfileFileDeploymentsEditor({
  files,
  rules,
  onChange,
  disabled = false,
}: WindowsProfileFileDeploymentsEditorProps) {
  const { t } = useTranslation()

  const updateRule = (index: number, patch: Partial<ProfileFileDeploymentRule>) => {
    onChange(rules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)))
  }

  const removeRule = (index: number) => {
    onChange(rules.filter((_, ruleIndex) => ruleIndex !== index))
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('windowsConfigurations.fileDeployments.empty')}</p>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div key={rule.id ?? `new-${index}`} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {t('windowsConfigurations.fileDeployments.ruleTitle', { index: index + 1 })}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() => removeRule(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`file-deploy-file-${index}`}>{t('windowsConfigurations.fileDeployments.file')}</Label>
                <select
                  id={`file-deploy-file-${index}`}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={rule.fileId || ''}
                  disabled={disabled}
                  onChange={(event) =>
                    updateRule(index, { fileId: Number.parseInt(event.target.value, 10) || 0 })
                  }
                >
                  <option value="">{t('windowsConfigurations.fileDeployments.selectFile')}</option>
                  {files.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.originalName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`file-deploy-dest-${index}`}>
                  {t('windowsConfigurations.fileDeployments.destinationPath')}
                </Label>
                <Input
                  id={`file-deploy-dest-${index}`}
                  value={rule.destinationPath}
                  placeholder={t('windowsConfigurations.fileDeployments.destinationPlaceholder')}
                  disabled={disabled}
                  onChange={(event) => updateRule(index, { destinationPath: event.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rule.unzip}
                  disabled={disabled}
                  onChange={(event) => updateRule(index, { unzip: event.target.checked })}
                />
                {t('windowsConfigurations.fileDeployments.unzip')}
              </label>

              <div className="space-y-2">
                <Label htmlFor={`file-deploy-script-${index}`}>
                  {t('windowsConfigurations.fileDeployments.postActionScript')}
                </Label>
                <Textarea
                  id={`file-deploy-script-${index}`}
                  value={rule.postActionScript ?? ''}
                  placeholder={t('windowsConfigurations.fileDeployments.postActionPlaceholder')}
                  disabled={disabled}
                  rows={3}
                  onChange={(event) => updateRule(index, { postActionScript: event.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={disabled || files.length === 0}
        onClick={() => onChange([...rules, createEmptyRule()])}
      >
        <Plus className="size-4" />
        {t('windowsConfigurations.fileDeployments.addRule')}
      </Button>
    </div>
  )
}
