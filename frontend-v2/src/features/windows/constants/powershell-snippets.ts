export interface PowerShellSnippet {
  id: string
  labelKey: string
  script: string
}

export const POWERSHELL_SNIPPETS: PowerShellSnippet[] = [
  {
    id: 'clear-dns-cache',
    labelKey: 'deviceDetail.actions.powershellSnippets.clearDnsCache',
    script: 'ipconfig /flushdns',
  },
  {
    id: 'active-network-adapters',
    labelKey: 'deviceDetail.actions.powershellSnippets.activeNetworkAdapters',
    script:
      "Get-NetAdapter | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, Status, MacAddress",
  },
  {
    id: 'restart-print-spooler',
    labelKey: 'deviceDetail.actions.powershellSnippets.restartPrintSpooler',
    script: 'Restart-Service -Name Spooler -Force',
  },
  {
    id: 'top-cpu-processes',
    labelKey: 'deviceDetail.actions.powershellSnippets.topCpuProcesses',
    script:
      'Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 -Property Name, CPU, WorkingSet',
  },
  {
    id: 'check-pending-reboots',
    labelKey: 'deviceDetail.actions.powershellSnippets.checkPendingReboots',
    script:
      'Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Component Based Servicing\\RebootPending"',
  },
]

export const DEFAULT_POWERSHELL_SCRIPT =
  'Get-ComputerInfo | Select-Object CsName, WindowsVersion, OsArchitecture'
