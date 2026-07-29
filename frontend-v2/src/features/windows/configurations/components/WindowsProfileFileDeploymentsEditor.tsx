import { FolderOpen, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileFileDeploymentRule } from '@/features/windows/files/types/stored-file'
import type { StoredFile } from '@/features/windows/files/types/stored-file'
import { WindowsConfigEditorEmptyState } from '@/features/windows/configurations/components/WindowsConfigEditorNav'
import { Button } from '@/components/ui/button'
import { FlatSelect } from '@/components/ui/flat-select'
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

  const addRule = () => {
    onChange([...rules, createEmptyRule()])
  }

  const fileOptions = files.map((file) => ({
    value: String(file.id),
    label: file.originalName,
  }))

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <WindowsConfigEditorEmptyState
          icon={<FolderOpen className="size-12 stroke-[1.25]" />}
          title={t('windowsConfigurations.fileDeployments.emptyTitle')}
          description={t('windowsConfigurations.fileDeployments.emptyDescription')}
          action={
            <Button
              type="button"
              variant="outline"
              disabled={disabled || files.length === 0}
              onClick={addRule}
            >
              <Plus className="size-4" />
              {t('windowsConfigurations.fileDeployments.addRule')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div key={rule.id ?? `new-${index}`} className="space-y-3 border border-zinc-700/80 p-4">
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
                  <Label htmlFor={`file-deploy-file-${index}`}>
                    {t('windowsConfigurations.fileDeployments.file')}
                  </Label>
                  <FlatSelect
                    id={`file-deploy-file-${index}`}
                    value={rule.fileId ? String(rule.fileId) : ''}
                    disabled={disabled}
                    placeholder={t('windowsConfigurations.fileDeployments.selectFile')}
                    onChange={(value) =>
                      updateRule(index, { fileId: Number.parseInt(value, 10) || 0 })
                    }
                    options={[
                      { value: '', label: t('windowsConfigurations.fileDeployments.selectFile') },
                      ...fileOptions,
                    ]}
                  />
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
                    className="border-zinc-700 bg-zinc-800/80 focus-visible:border-zinc-500 focus-visible:ring-0"
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
                    className="border-zinc-700 bg-zinc-800/80 focus-visible:border-zinc-500 focus-visible:ring-0"
                    onChange={(event) => updateRule(index, { postActionScript: event.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={disabled || files.length === 0}
            onClick={addRule}
          >
            <Plus className="size-4" />
            {t('windowsConfigurations.fileDeployments.addRule')}
          </Button>
        </>
      )}
    </div>
  )
}
