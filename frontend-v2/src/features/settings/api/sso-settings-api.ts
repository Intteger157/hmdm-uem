export interface EntraIdSsoSettings {
  enabled: boolean
  tenantId: string
  clientId: string
  clientSecret: string
}

/** Stub until Go/Java SSO API is wired. */
export async function saveEntraIdSsoSettings(settings: EntraIdSsoSettings): Promise<void> {
  const payload = {
    provider: 'microsoft_entra_id',
    enabled: settings.enabled,
    tenantId: settings.tenantId.trim(),
    clientId: settings.clientId.trim(),
    clientSecret: settings.clientSecret,
  }
  console.log('[sso-settings] save configuration', payload)
  await new Promise((resolve) => setTimeout(resolve, 250))
}
