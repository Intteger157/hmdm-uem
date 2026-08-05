import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'

/** Console administration routes on server-windows (Go). */
export const consoleAdminApi = axios.create({
  baseURL: WINDOWS_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(consoleAdminApi)

export function shouldFallbackFromGo(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false
  }
  const status = error.response?.status
  // 403 means the signed-in role is not a console administrator — do not retry Java.
  return status == null || (status !== 403 && status !== 401)
}
