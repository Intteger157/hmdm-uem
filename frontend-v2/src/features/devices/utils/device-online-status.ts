export type DeviceOnlineStatusCode = 'green' | 'yellow' | 'red' | 'grey' | 'brown'

/** Android sends device info at most every 15 minutes (WorkManager minimum). */
export const DEVICE_ONLINE_GREEN_MS = 20 * 60 * 1000
export const DEVICE_ONLINE_YELLOW_MS = 2 * 60 * 60 * 1000

export function getDeviceOnlineStatusCode(
  lastUpdate?: number,
  now = Date.now(),
): DeviceOnlineStatusCode {
  if (lastUpdate == null || lastUpdate <= 0) {
    return 'grey'
  }

  const ageMs = now - lastUpdate
  if (ageMs < DEVICE_ONLINE_GREEN_MS) {
    return 'green'
  }
  if (ageMs < DEVICE_ONLINE_YELLOW_MS) {
    return 'yellow'
  }
  return 'red'
}

export function resolveDeviceOnlineStatusCode(
  device: {
    lastUpdate?: number
    statusCode?: string
    windowsAgentStatus?: 'active' | 'uninstalled'
  },
  now = Date.now(),
): DeviceOnlineStatusCode {
  if (device.windowsAgentStatus === 'uninstalled') {
    return 'brown'
  }

  if (device.lastUpdate != null && device.lastUpdate > 0) {
    return getDeviceOnlineStatusCode(device.lastUpdate, now)
  }
  const code = device.statusCode
  if (code === 'green' || code === 'yellow' || code === 'red' || code === 'grey') {
    return code
  }
  return 'grey'
}
