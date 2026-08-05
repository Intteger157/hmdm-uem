import axios from 'axios'
import { WINDOWS_API_BASE } from '@/shared/api/config'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'

/**
 * Android console routes on Go. Default path sits under /rest/windows/android so
 * gateways that already proxy /rest/windows/ to server-windows work without an
 * extra /rest/android nginx location.
 */
export const ANDROID_API_BASE =
  import.meta.env.VITE_ANDROID_API_BASE ?? `${WINDOWS_API_BASE}/android`

export const androidApi = axios.create({
  baseURL: ANDROID_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(androidApi)
