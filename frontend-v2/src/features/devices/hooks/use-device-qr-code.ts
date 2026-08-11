import { useQuery } from '@tanstack/react-query'
import { fetchDeviceQrCodeBlob } from '@/features/devices/api/devices-api'
import { DEVICE_ENROLLMENT_QR_SIZE } from '@/features/devices/lib/enrollment-qr-size'

export const deviceQrQueryKeys = {
  all: ['device-qr'] as const,
  image: (qrCodeKey: string, deviceId: string, size: number) =>
    [...deviceQrQueryKeys.all, qrCodeKey, deviceId, size] as const,
}

export function useDeviceQrCode(
  qrCodeKey: string | undefined,
  deviceId: string | undefined,
  enabled = true,
  size = DEVICE_ENROLLMENT_QR_SIZE,
) {
  return useQuery({
    queryKey: deviceQrQueryKeys.image(qrCodeKey ?? '', deviceId ?? '', size),
    queryFn: () => fetchDeviceQrCodeBlob(qrCodeKey!, deviceId!, size),
    enabled: enabled && qrCodeKey != null && qrCodeKey.length > 0 && deviceId != null && deviceId.length > 0,
    staleTime: 5 * 60_000,
  })
}
