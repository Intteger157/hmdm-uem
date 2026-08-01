import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'

export interface EntraIdSsoSettings {
  enabled: boolean
  tenantId: string
  clientId: string
  clientSecret: string
}

interface SsoSettingsResponse extends EntraIdSsoSettings {
  provider: string
}

/** Routed under /rest/windows so existing gateway proxies reach Go without /rest/sso. */
const ssoApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(ssoApi)

function toEntraIdSsoSettings(data: SsoSettingsResponse): EntraIdSsoSettings {
  return {
    enabled: data.enabled,
    tenantId: data.tenantId ?? '',
    clientId: data.clientId ?? '',
    clientSecret: data.clientSecret ?? '',
  }
}

export function getSsoSettingsErrorMessage(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined
  }

  const payload = error.response?.data
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const message = (payload as { error?: unknown }).error
    if (typeof message === 'string' && message.trim() !== '') {
      return message
    }
  }

  const status = error.response?.status
  if (status === 404) {
    return 'SSO API is unavailable — redeploy server-windows and gateway'
  }
  if (status === 503) {
    return 'Authentication service is not configured on the server'
  }

  return undefined
}

export async function fetchEntraIdSsoSettings(): Promise<EntraIdSsoSettings> {
  if (isMockApiEnabled()) {
    return {
      enabled: false,
      tenantId: '',
      clientId: '',
      clientSecret: '',
    }
  }

  const response = await ssoApi.get<SsoSettingsResponse>('/sso-settings')
  return toEntraIdSsoSettings(response.data)
}

export async function saveEntraIdSsoSettings(settings: EntraIdSsoSettings): Promise<EntraIdSsoSettings> {
  if (isMockApiEnabled()) {
    return settings
  }

  const payload = {
    provider: 'entra',
    enabled: settings.enabled,
    tenantId: settings.tenantId.trim(),
    clientId: settings.clientId.trim(),
    clientSecret: settings.clientSecret,
  }

  const response = await ssoApi.put<SsoSettingsResponse>('/sso-settings', payload)
  return toEntraIdSsoSettings(response.data)
}
