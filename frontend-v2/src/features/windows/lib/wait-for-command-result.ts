import { getLatestWindowsDeviceCommand } from '@/features/windows/api/windows-api'

const POLL_INTERVAL_MS = 3_000
const POLL_ATTEMPTS = 10

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Polls until the queued command finishes and returns the terminal status. */
export async function waitForWindowsCommandResult(
  hardwareId: string,
  commandId: number,
): Promise<{ success: boolean; message: string } | null> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS)

    try {
      const latest = await getLatestWindowsDeviceCommand(hardwareId)
      if (latest.id < commandId) {
        continue
      }
      if (latest.status === 'pending' || latest.status === 'running') {
        continue
      }
      return {
        success: latest.status === 'completed',
        message: latest.result?.trim() || latest.status,
      }
    } catch {
      continue
    }
  }

  return null
}
