import axios from 'axios'
import { setupAuthInterceptors } from '@/shared/api/setup-auth-interceptors'

/** Go server-android console routes (always /rest/android at the gateway unless overridden). */
export const ANDROID_API_BASE = import.meta.env.VITE_ANDROID_API_BASE ?? '/rest/android'

export const androidApi = axios.create({
  baseURL: ANDROID_API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

setupAuthInterceptors(androidApi)
