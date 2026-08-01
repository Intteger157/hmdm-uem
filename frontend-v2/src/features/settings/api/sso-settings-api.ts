import axios from 'axios'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'
import { isMockApiEnabled } from '@/shared/api/mock-utils'

const SSO_API_BASE = import.meta.env.VITE_SSO_API_BASE ?? '/rest/sso'

export interface EntraIdSsoSettings {
  enabled: boolean
  tenantId: string
  clientId: string
  clientSecret: string
}

interface SsoSettingsResponse extends EntraIdSsoSettings {
  provider: string
}

const ssoApi = axios.create({
  baseURL: SSO_API_BASE,
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

export async function fetchEntraIdSsoSettings(): Promise<EntraIdSsoSettings> {
  if (isMockApiEnabled()) {
    return {
      enabled: false,
      tenantId: '',
      clientId: '',
      clientSecret: '',
    }
  }

  const response = await ssoApi.get<SsoSettingsResponse>('/settings')
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

  const response = await ssoApi.put<SsoSettingsResponse>('/settings', payload)
  return toEntraIdSsoSettings(response.data)
}
