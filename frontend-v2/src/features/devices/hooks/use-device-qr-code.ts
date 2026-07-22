import { useQuery } from '@tanstack/react-query'
import { fetchDeviceQrCodeBlob } from '@/features/devices/api/devices-api'

export const deviceQrQueryKeys = {
  all: ['device-qr'] as const,
  image: (qrCodeKey: string, deviceId: string) =>
    [...deviceQrQueryKeys.all, qrCodeKey, deviceId] as const,
}

export function useDeviceQrCode(
  qrCodeKey: string | undefined,
  deviceId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: deviceQrQueryKeys.image(qrCodeKey ?? '', deviceId ?? ''),
    queryFn: () => fetchDeviceQrCodeBlob(qrCodeKey!, deviceId!),
    enabled: enabled && qrCodeKey != null && qrCodeKey.length > 0 && deviceId != null && deviceId.length > 0,
    staleTime: 5 * 60_000,
  })
}
