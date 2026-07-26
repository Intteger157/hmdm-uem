export function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

export function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export interface UploadProgressState {
  percent: number
  loaded: number
  total: number
}

export function buildUploadProgressLabel(progress: UploadProgressState): string {
  if (progress.total > 0) {
    return `${formatUploadBytes(progress.loaded)} / ${formatUploadBytes(progress.total)} (${progress.percent}%)`
  }
  return `${formatUploadBytes(progress.loaded)} (${progress.percent}%)`
}
