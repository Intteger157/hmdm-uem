import type { ProfileAppAssignment } from '@/features/windows/applications/types/software-app'
import type { SoftwareApp } from '@/features/windows/applications/types/software-app'
import type { WindowsConfigProfilePayload } from '@/features/windows/configurations/types/config-profile'
import { DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD } from '@/features/windows/configurations/types/config-profile'

function coercePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }
  return null
}

function coerceOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value == null || value === '') {
    return null
  }
  return coercePositiveInt(value)
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }

  return null
}

export function formatDisplayText(value: unknown, fallback = '—'): string {
  if (value == null) {
    return fallback
  }

  if (typeof value === 'string') {
    const parsedRecord = parseJsonRecord(value)
    if (parsedRecord) {
      return formatDisplayText(parsedRecord, fallback)
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : fallback
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatDisplayText(item, '')).filter(Boolean).join(', ') || fallback
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (record.version != null) {
      return formatDisplayText(record.version, fallback)
    }
    if (record.name != null) {
      return formatDisplayText(record.name, fallback)
    }
    if (record.label != null) {
      return formatDisplayText(record.label, fallback)
    }
    if (record.versionPolicy != null || record.version_policy != null) {
      return formatVersionPolicyLabel(record.versionPolicy ?? record.version_policy)
    }
  }

  return fallback
}

export function formatVersionPolicyLabel(value: unknown): string {
  const text = formatDisplayText(value, 'latest')
  return text.toLowerCase() === 'latest' ? 'Latest' : text
}

function versionPolicyToVersionId(value: unknown): number | null | undefined {
  if (value == null || value === '') {
    return null
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    if (record.versionId != null || record.version_id != null) {
      return coerceOptionalPositiveInt(record.versionId ?? record.version_id) ?? null
    }
    if (record.version != null) {
      return null
    }
  }

  const policy = formatDisplayText(value, 'latest').toLowerCase()
  if (policy === 'latest') {
    return null
  }

  return coerceOptionalPositiveInt(policy) ?? null
}

export function normalizeProfileAppAssignment(raw: unknown): ProfileAppAssignment | null {
  let candidate: unknown = raw

  if (typeof raw === 'string') {
    const parsedRecord = parseJsonRecord(raw)
    if (!parsedRecord) {
      return null
    }
    candidate = parsedRecord
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null
  }

  const record = candidate as Record<string, unknown>
  const appId = coercePositiveInt(record.appId ?? record.app_id)
  if (!appId) {
    return null
  }

  let versionId =
    coerceOptionalPositiveInt(record.versionId ?? record.version_id) ??
    versionPolicyToVersionId(record.versionPolicy ?? record.version_policy)

  if (versionId === undefined) {
    versionId = null
  }

  return {
    appId,
    versionId: versionId ?? undefined,
  }
}

export function normalizeProfileAppAssignments(raw: unknown): ProfileAppAssignment[] {
  if (raw == null) {
    return []
  }

  let items: unknown[] = []
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        items = parsed
      } else if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>
        if (Array.isArray(record.assignments)) {
          items = record.assignments
        } else if (Array.isArray(record.requiredApps) || Array.isArray(record.required_apps)) {
          items = (record.requiredApps ?? record.required_apps) as unknown[]
        } else {
          items = [parsed]
        }
      }
    } catch {
      return []
    }
  } else if (Array.isArray(raw)) {
    items = raw
  } else if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>
    if (Array.isArray(record.assignments)) {
      items = record.assignments
    } else {
      items = [raw]
    }
  }

  const seen = new Set<number>()
  const normalized: ProfileAppAssignment[] = []

  for (const item of items) {
    const assignment = normalizeProfileAppAssignment(item)
    if (!assignment || seen.has(assignment.appId)) {
      continue
    }
    seen.add(assignment.appId)
    normalized.push(assignment)
  }

  return normalized
}

export function resolveVersionSelectValue(assignment: ProfileAppAssignment): string {
  if (assignment.versionId == null || assignment.versionId === 0) {
    return 'latest'
  }
  return String(assignment.versionId)
}

export function formatAppVersionLabel(app: SoftwareApp, versionId: number | null | undefined): string {
  if (versionId == null || versionId === 0) {
    return formatDisplayText(app.latestVersion, '—')
  }

  const version = app.versions.find((item) => item.id === versionId)
  if (!version) {
    return `#${versionId}`
  }

  return formatDisplayText(version.version, `#${version.id}`)
}

export function normalizeConfigProfilePayload(raw: unknown): WindowsConfigProfilePayload {
  let candidate: unknown = raw

  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw)
    } catch {
      return { ...DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD }
    }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ...DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD }
  }

  const record = candidate as Record<string, unknown>
  const screenLockTimeout = coerceOptionalPositiveInt(record.screenLockTimeout)

  return {
    defenderEnabled: Boolean(record.defenderEnabled),
    blockUsbStorage: Boolean(record.blockUsbStorage),
    usbReadOnly: Boolean(record.usbReadOnly),
    screenLockTimeout: screenLockTimeout ?? 0,
  }
}
