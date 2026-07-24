import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
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
        <p className="text-sm text-muted-foreground">{t('windowsConfigurations.registryPolicies.empty')}</p>
      ) : (
        <div className="space-y-3">
          {policies.map((policy, index) => (
            <div
              key={policy.id ?? `policy-${index}`}
              className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
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
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('windowsConfigurations.registryPolicies.valueType')}
                </label>
                <NativeSelect
                  value={policy.valueType}
                  onChange={(event) => updatePolicy(index, { valueType: event.target.value })}
                  disabled={disabled}
                >
                  {VALUE_TYPES.map((valueType) => (
                    <option key={valueType} value={valueType}>
                      {valueType}
                    </option>
                  ))}
                </NativeSelect>
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
      )}

      <Button type="button" variant="outline" onClick={addPolicy} disabled={disabled}>
        <Plus className="size-4" />
        {t('windowsConfigurations.registryPolicies.add')}
      </Button>
    </div>
  )
}
