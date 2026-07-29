import { useAuthStore } from '@/features/auth/store/auth-store'

// WebSocket handshakes cannot carry an Authorization header, so the JWT travels as a query param.
export function buildDeviceFileExplorerWebSocketUrl(hardwareId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = new URL(`${protocol}//${window.location.host}/api/filexplorer/admin`)

  url.searchParams.set('deviceID', hardwareId)

  const jwt = useAuthStore.getState().jwt
  if (jwt) {
    url.searchParams.set('token', jwt)
  }

  return url.toString()
}
