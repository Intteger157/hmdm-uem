import axios from 'axios'
import { isMockApiEnabled } from '@/shared/api/mock-utils'

export interface SsoStatus {
  entraEnabled: boolean
}

const ssoStatusApi = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function fetchPublicSsoStatus(): Promise<SsoStatus> {
  if (isMockApiEnabled()) {
    return { entraEnabled: false }
  }

  const response = await ssoStatusApi.get<SsoStatus>('/sso-status')
  return {
    entraEnabled: Boolean(response.data.entraEnabled),
  }
}
