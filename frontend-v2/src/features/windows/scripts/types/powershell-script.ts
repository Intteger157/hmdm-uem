export type PowerShellExecutionContext = 'System' | 'User'

export interface PowerShellScript {
  id: number
  name: string
  description: string
  content: string
  executionContext: PowerShellExecutionContext
  createdAt: string
  updatedAt: string
}

export interface PowerShellScriptListResponse {
  items: PowerShellScript[]
  totalItemsCount: number
}

export interface UpsertPowerShellScriptPayload {
  name: string
  description?: string
  content: string
  executionContext: PowerShellExecutionContext
}

export interface PowerShellScriptPreset {
  id: string
  name: string
  description: string
  content: string
  executionContext: PowerShellExecutionContext
}

export const POWERSHELL_SCRIPT_PRESETS: PowerShellScriptPreset[] = [
  {
    id: 'clear-temp-files',
    name: 'Clear Temp Files',
    description: 'Очистка временных файлов пользователя и системы.',
    content:
      'Remove-Item -Path $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue; Write-Output "Temporary files cleared."',
    executionContext: 'System',
  },
  {
    id: 'restart-print-spooler',
    name: 'Restart Print Spooler',
    description: 'Перезапуск службы печати при зависании очереди.',
    content: 'Restart-Service -Name Spooler -Force; Write-Output "Print spooler restarted successfully."',
    executionContext: 'System',
  },
  {
    id: 'flush-dns-renew-ip',
    name: 'Flush DNS & Renew IP',
    description: 'Сброс кэша DNS и обновление IP-адреса (Network Fix).',
    content: 'Clear-DnsClientCache; ipconfig /renew; Write-Output "DNS cache flushed and IP renewed."',
    executionContext: 'System',
  },
  {
    id: 'restart-explorer',
    name: 'Restart Windows Explorer',
    description: 'Перезапуск проводника при зависании рабочего стола.',
    content: 'Stop-Process -Name explorer -Force; Write-Output "Windows Explorer restarted."',
    executionContext: 'User',
  },
  {
    id: 'reset-windows-update-cache',
    name: 'Reset Windows Update Cache',
    description: 'Сброс кэша обновлений Windows при залипших загрузках.',
    content:
      'Stop-Service -Name wuauserv -Force; Stop-Service -Name bits -Force; Remove-Item -Path "$env:windir\\SoftwareDistribution\\Download\\*" -Recurse -Force; Start-Service -Name wuauserv; Start-Service -Name bits; Write-Output "Windows Update cache cleared."',
    executionContext: 'System',
  },
  {
    id: 'restart-audio-service',
    name: 'Restart Audio Service',
    description: 'Перезапуск службы звука при его внезапном пропадании.',
    content:
      'Restart-Service -Name Audiosrv -Force; Restart-Service -Name AudioEndpointBuilder -Force; Write-Output "Audio services restarted."',
    executionContext: 'System',
  },
]

export function buildPowerShellCommandPayload(
  script: string,
  executionContext: PowerShellExecutionContext = 'System',
): string {
  const trimmed = script.trim()
  if (executionContext === 'System') {
    return trimmed
  }
  return JSON.stringify({ script: trimmed, executionContext })
}
