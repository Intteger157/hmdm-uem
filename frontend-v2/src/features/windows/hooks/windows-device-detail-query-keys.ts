export const WINDOWS_DEVICE_POLL_INTERVAL_MS = 5000

export const windowsDeviceDetailQueryKeys = {
  services: (hardwareId: string) => ['windows', 'device', hardwareId, 'services'] as const,
  commandLogs: (hardwareId: string) => ['windows', 'device', hardwareId, 'command-logs'] as const,
}

export const windowsDevicePollingQueryOptions = {
  refetchInterval: WINDOWS_DEVICE_POLL_INTERVAL_MS,
  refetchOnWindowFocus: true,
} as const
