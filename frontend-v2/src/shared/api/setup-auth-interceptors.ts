import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/features/auth/store/auth-store'

/** Send the console JWT with every request on this instance. */
export function attachAuthToken(instance: AxiosInstance): void {
  instance.interceptors.request.use((config) => {
    const jwt = useAuthStore.getState().jwt
    if (jwt) {
      config.headers.Authorization = `Bearer ${jwt}`
    }
    return config
  })
}

/** Attach the console JWT and force re-login when the session is rejected. */
export function setupAuthInterceptors(instance: AxiosInstance): void {
  attachAuthToken(instance)

  instance.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      // 401 means the session is invalid. 403 means the caller is authenticated but
      // not allowed — common when Go SSO JWT is accepted by server-windows but a
      // Java /rest/private route still rejects the call. Logging out on 403 would
      // kick SSO users back to /login after the dashboard mounts.
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        useAuthStore.getState().logout()
        window.location.assign('/login')
      }
      return Promise.reject(error)
    },
  )
}
