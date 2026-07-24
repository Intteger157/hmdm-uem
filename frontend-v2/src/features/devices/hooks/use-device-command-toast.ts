import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { waitForCommandLogResult } from '@/features/windows/lib/wait-for-command-log-result'
import { waitForWindowsCommandResult } from '@/features/windows/lib/wait-for-command-result'

type CommandTrackingKind = 'poll' | 'action-log'

function buildToastId(hardwareId: string, commandId: number) {
  return `device-command-${hardwareId}-${commandId}`
}

interface UseDeviceCommandToastOptions {
  onGoToActionLogs: () => void
}

export function useDeviceCommandToast({ onGoToActionLogs }: UseDeviceCommandToastOptions) {
  const { t } = useTranslation()

  const trackCommand = useCallback(
    (hardwareId: string, commandId: number, kind: CommandTrackingKind) => {
      const toastId = buildToastId(hardwareId, commandId)
      const action = {
        label: t('deviceDetail.actions.goToActionLogs'),
        onClick: onGoToActionLogs,
      }

      toast.loading(t('deviceDetail.actions.commandWaiting'), {
        id: toastId,
        duration: Number.POSITIVE_INFINITY,
      })

      const waitForResult =
        kind === 'action-log'
          ? waitForCommandLogResult(hardwareId, commandId)
          : waitForWindowsCommandResult(hardwareId, commandId)

      void waitForResult.then((result) => {
        if (!result) {
          toast.error(t('deviceDetail.actions.commandTimedOut'), {
            id: toastId,
            duration: 10_000,
            action,
          })
          return
        }

        if (result.success) {
          toast.success(t('deviceDetail.actions.commandFinishedSuccess'), {
            id: toastId,
            duration: 10_000,
            action,
          })
          return
        }

        toast.error(result.message || t('deviceDetail.actions.commandFinishedFailed'), {
          id: toastId,
          duration: 10_000,
          action,
        })
      })
    },
    [onGoToActionLogs, t],
  )

  const trackPollCommand = useCallback(
    (hardwareId: string, commandId: number) => trackCommand(hardwareId, commandId, 'poll'),
    [trackCommand],
  )

  const trackActionLogCommand = useCallback(
    (hardwareId: string, commandId: number) => trackCommand(hardwareId, commandId, 'action-log'),
    [trackCommand],
  )

  return { trackPollCommand, trackActionLogCommand }
}
