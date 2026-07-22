import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchDeviceRemoteSettings,
  fetchDeviceRemoteStatus,
  startDeviceRemoteSession,
  stopDeviceRemoteSession,
  updateDeviceRemoteSettings,
  type DeviceRemoteSettings,
} from '@/features/plugins/deviceremote/api/deviceremote-api'

export const deviceremoteQueryKeys = {
  all: ['deviceremote'] as const,
  settings: () => [...deviceremoteQueryKeys.all, 'settings'] as const,
  status: (deviceId: number) => [...deviceremoteQueryKeys.all, 'status', deviceId] as const,
}

export function useDeviceRemoteSettingsQuery() {
  return useQuery({
    queryKey: deviceremoteQueryKeys.settings(),
    queryFn: fetchDeviceRemoteSettings,
  })
}

export function useDeviceRemoteStatusQuery(deviceId: number | undefined, enabled = false) {
  return useQuery({
    queryKey: deviceremoteQueryKeys.status(deviceId ?? 0),
    queryFn: () => fetchDeviceRemoteStatus(deviceId!),
    enabled: deviceId != null && deviceId > 0 && enabled,
    refetchInterval: enabled ? 1500 : false,
  })
}

export function useUpdateDeviceRemoteSettingsMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: DeviceRemoteSettings) => updateDeviceRemoteSettings(settings),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: deviceremoteQueryKeys.all })
    },
  })
}

export function useStartDeviceRemoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: number) => startDeviceRemoteSession(deviceId),
    onSuccess: async (_data, deviceId) => {
      await queryClient.invalidateQueries({ queryKey: deviceremoteQueryKeys.status(deviceId) })
    },
  })
}

export function useStopDeviceRemoteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deviceId: number) => stopDeviceRemoteSession(deviceId),
    onSuccess: async (_data, deviceId) => {
      await queryClient.invalidateQueries({ queryKey: deviceremoteQueryKeys.status(deviceId) })
    },
  })
}
