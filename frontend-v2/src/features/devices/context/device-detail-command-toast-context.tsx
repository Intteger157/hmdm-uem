import { createContext, useContext, type ReactNode } from 'react'
import { useDeviceCommandToast } from '@/features/devices/hooks/use-device-command-toast'

type DeviceCommandToastApi = ReturnType<typeof useDeviceCommandToast>

const DeviceDetailCommandToastContext = createContext<DeviceCommandToastApi | null>(null)

interface DeviceDetailCommandToastProviderProps {
  onGoToActionLogs: () => void
  children: ReactNode
}

export function DeviceDetailCommandToastProvider({
  onGoToActionLogs,
  children,
}: DeviceDetailCommandToastProviderProps) {
  const value = useDeviceCommandToast({ onGoToActionLogs })

  return (
    <DeviceDetailCommandToastContext.Provider value={value}>
      {children}
    </DeviceDetailCommandToastContext.Provider>
  )
}

export function useDeviceDetailCommandToast(): DeviceCommandToastApi {
  const context = useContext(DeviceDetailCommandToastContext)
  if (!context) {
    throw new Error('useDeviceDetailCommandToast must be used within DeviceDetailCommandToastProvider')
  }
  return context
}
