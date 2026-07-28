import { API_BASE } from '@/shared/api/config'
import { useAuthStore } from '@/features/auth/store/auth-store'

// WebSocket handshakes cannot carry an Authorization header, so the JWT travels as a query param.
export function buildDeviceTerminalWebSocketUrl(hardwareId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = `${API_BASE}/windows/devices/${encodeURIComponent(hardwareId)}/terminal`
  const url = new URL(`${protocol}//${window.location.host}${path}`)

  const jwt = useAuthStore.getState().jwt
  if (jwt) {
    url.searchParams.set('token', jwt)
  }

  return url.toString()
}
