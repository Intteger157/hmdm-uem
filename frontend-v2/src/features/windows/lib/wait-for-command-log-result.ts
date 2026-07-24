import { getWindowsDeviceCommandLogs } from '@/features/windows/api/windows-api'

const POLL_INTERVAL_MS = 3_000
const POLL_ATTEMPTS = 40

const IN_PROGRESS_LOG_STATUSES = new Set([
  'Pending',
  'Downloading',
  'Installing',
  'AppCheck',
  'AppDownload',
  'AppUnblock',
  'AppInstall',
  'AppResult',
])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Polls Action Logs until the queued command log reaches a terminal status. */
export async function waitForCommandLogResult(
  hardwareId: string,
  commandLogId: number,
): Promise<{ success: boolean; message: string } | null> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    try {
      const logs = await getWindowsDeviceCommandLogs(hardwareId)
      const entry = logs.items.find((item) => item.id === commandLogId)
      if (!entry) {
        continue
      }
      if (IN_PROGRESS_LOG_STATUSES.has(entry.status)) {
        continue
      }
      return {
        success: entry.status === 'Success',
        message: entry.output?.trim() || entry.status,
      }
    } catch {
      continue
    }
  }

  return null
}
