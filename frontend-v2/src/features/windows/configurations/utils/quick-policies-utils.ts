import { QUICK_POLICIES_PRESETS, type QuickPolicyPreset } from '@/features/windows/configurations/constants/quick-policies-presets'
import type { WindowsConfigurationPolicy } from '@/features/windows/configurations/types/config-profile'

export function normalizeRegistryPath(path: string): string {
  return path.trim().replace(/\//g, '\\').replace(/\\+/g, '\\').toUpperCase()
}

export function findPresetByPolicyPath(policyPath: string): QuickPolicyPreset | undefined {
  const normalized = normalizeRegistryPath(policyPath)
  return QUICK_POLICIES_PRESETS.find(
    (preset) => normalizeRegistryPath(preset.registryPath) === normalized,
  )
}

export function presetToRegistryPolicy(preset: QuickPolicyPreset): WindowsConfigurationPolicy {
  return {
    policyPath: preset.registryPath,
    valueType: preset.type,
    value: String(preset.value),
  }
}

export function partitionPoliciesByPresets(policies: WindowsConfigurationPolicy[]): {
  enabledQuickPolicyIds: string[]
  manualPolicies: WindowsConfigurationPolicy[]
} {
  const enabledQuickPolicyIds: string[] = []
  const manualPolicies: WindowsConfigurationPolicy[] = []

  for (const policy of policies) {
    const preset = findPresetByPolicyPath(policy.policyPath)
    if (preset) {
      if (!enabledQuickPolicyIds.includes(preset.id)) {
        enabledQuickPolicyIds.push(preset.id)
      }
      continue
    }

    manualPolicies.push(policy)
  }

  return { enabledQuickPolicyIds, manualPolicies }
}

export function buildRegistryPoliciesForSubmit(
  manualPolicies: WindowsConfigurationPolicy[],
  enabledQuickPolicyIds: string[],
): WindowsConfigurationPolicy[] {
  const presetPolicies = enabledQuickPolicyIds
    .map((presetId) => QUICK_POLICIES_PRESETS.find((preset) => preset.id === presetId))
    .filter((preset): preset is QuickPolicyPreset => preset != null)
    .map(presetToRegistryPolicy)

  const manualWithoutPresets = manualPolicies.filter(
    (policy) => findPresetByPolicyPath(policy.policyPath) == null,
  )

  return [...manualWithoutPresets, ...presetPolicies]
}
