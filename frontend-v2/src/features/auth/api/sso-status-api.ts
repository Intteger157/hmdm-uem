import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { isMockApiEnabled } from '@/shared/api/mock-utils'

export interface SsoStatus {
  entraEnabled: boolean
}

/** Uses /rest/windows/public/* so gateways that only proxy /rest/windows/ reach Go. */
const ssoStatusApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const MICROSOFT_LOGIN_PATH = `${WINDOWS_API_BASE}/public/auth/login/microsoft`

export async function fetchPublicSsoStatus(): Promise<SsoStatus> {
  if (isMockApiEnabled()) {
    return { entraEnabled: false }
  }

  const response = await ssoStatusApi.get<SsoStatus>('/public/sso-status')
  return {
    entraEnabled: Boolean(response.data.entraEnabled),
  }
}
