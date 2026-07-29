import { FolderKey, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { WindowsConfigEditorEmptyState } from '@/features/windows/configurations/components/WindowsConfigEditorNav'
import { Button } from '@/components/ui/button'
import { FlatSelect } from '@/components/ui/flat-select'
import { Input } from '@/components/ui/input'
import type { WindowsConfigurationPolicy } from '@/features/windows/configurations/types/config-profile'

const VALUE_TYPES = ['DWORD', 'String', 'ExpandString', 'MultiString', 'Binary'] as const

export function createEmptyRegistryPolicy(): WindowsConfigurationPolicy {
  return {
    policyPath: '',
    valueType: 'DWORD',
    value: '',
  }
}

interface WindowsRegistryPoliciesEditorProps {
  policies: WindowsConfigurationPolicy[]
  onChange: (policies: WindowsConfigurationPolicy[]) => void
  disabled?: boolean
}

export function WindowsRegistryPoliciesEditor({
  policies,
  onChange,
  disabled = false,
}: WindowsRegistryPoliciesEditorProps) {
  const { t } = useTranslation()

  const updatePolicy = (index: number, patch: Partial<WindowsConfigurationPolicy>) => {
    onChange(
      policies.map((policy, policyIndex) =>
        policyIndex === index ? { ...policy, ...patch } : policy,
      ),
    )
  }

  const removePolicy = (index: number) => {
    onChange(policies.filter((_, policyIndex) => policyIndex !== index))
  }

  const addPolicy = () => {
    onChange([...policies, createEmptyRegistryPolicy()])
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('windowsConfigurations.registryPolicies.hint')}
      </p>

      {policies.length === 0 ? (
        <WindowsConfigEditorEmptyState
          icon={<FolderKey className="size-12 stroke-[1.25]" />}
          title={t('windowsConfigurations.registryPolicies.emptyTitle')}
          description={t('windowsConfigurations.registryPolicies.emptyDescription')}
          action={
            <Button type="button" variant="outline" onClick={addPolicy} disabled={disabled}>
              <Plus className="size-4" />
              {t('windowsConfigurations.registryPolicies.add')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {policies.map((policy, index) => (
              <div
                key={policy.id ?? `policy-${index}`}
                className="grid gap-3 border border-zinc-700/80 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('windowsConfigurations.registryPolicies.policyPath')}
                  </label>
                  <Input
                    value={policy.policyPath}
                    onChange={(event) => updatePolicy(index, { policyPath: event.target.value })}
                    placeholder="HKLM\\Software\\Policies\\Microsoft\\Windows\\Personalization\\NoLockScreen"
                    disabled={disabled}
                    autoComplete="off"
                    className="border-zinc-700 bg-zinc-800/80 focus-visible:border-zinc-500 focus-visible:ring-0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('windowsConfigurations.registryPolicies.valueType')}
                  </label>
                  <FlatSelect
                    value={policy.valueType}
                    disabled={disabled}
                    onChange={(valueType) => updatePolicy(index, { valueType })}
                    options={VALUE_TYPES.map((valueType) => ({
                      value: valueType,
                      label: valueType,
                    }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t('windowsConfigurations.registryPolicies.value')}
                  </label>
                  <Input
                    value={policy.value}
                    onChange={(event) => updatePolicy(index, { value: event.target.value })}
                    placeholder="1"
                    disabled={disabled}
                    autoComplete="off"
                    className="border-zinc-700 bg-zinc-800/80 focus-visible:border-zinc-500 focus-visible:ring-0"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removePolicy(index)}
                    disabled={disabled}
                    aria-label={t('windowsConfigurations.registryPolicies.remove')}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addPolicy} disabled={disabled}>
            <Plus className="size-4" />
            {t('windowsConfigurations.registryPolicies.add')}
          </Button>
        </>
      )}
    </div>
  )
}
