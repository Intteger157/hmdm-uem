export interface RemoteProcessSnapshot {
  pid: number
  name: string
  memoryBytes: number
  cpuPercent: number
}

export interface ProcessListMessage {
  type: 'process_list'
  processes: RemoteProcessSnapshot[]
}

export function formatMemoryMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0.0'
  }
  return (bytes / (1024 * 1024)).toFixed(1)
}

export function sortProcessesByMemoryDesc(processes: RemoteProcessSnapshot[]): RemoteProcessSnapshot[] {
  return [...processes].sort((left, right) => right.memoryBytes - left.memoryBytes)
}

export function parseProcessListMessage(raw: string): RemoteProcessSnapshot[] | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ProcessListMessage>
    if (parsed.type !== 'process_list' || !Array.isArray(parsed.processes)) {
      return null
    }

    return parsed.processes
      .filter(
        (item): item is RemoteProcessSnapshot =>
          item != null &&
          typeof item.pid === 'number' &&
          typeof item.name === 'string' &&
          typeof item.memoryBytes === 'number' &&
          typeof item.cpuPercent === 'number',
      )
      .map((item) => ({
        pid: item.pid,
        name: item.name,
        memoryBytes: item.memoryBytes,
        cpuPercent: item.cpuPercent,
      }))
  } catch {
    return null
  }
}
