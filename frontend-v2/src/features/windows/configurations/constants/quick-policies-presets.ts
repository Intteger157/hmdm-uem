export interface QuickPolicyPreset {
  id: string
  labelKey: string
  descriptionKey: string
  registryPath: string
  type: 'DWORD'
  value: number
}

export const QUICK_POLICIES_PRESETS: QuickPolicyPreset[] = [
  {
    id: 'block-autorun',
    labelKey: 'windowsConfigurations.quickSettings.presets.blockAutoRun.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.blockAutoRun.description',
    registryPath:
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\NoDriveTypeAutoRun',
    type: 'DWORD',
    value: 255,
  },
  {
    id: 'enable-rdp',
    labelKey: 'windowsConfigurations.quickSettings.presets.enableRdp.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.enableRdp.description',
    registryPath: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\fDenyTSConnections',
    type: 'DWORD',
    value: 0,
  },
  {
    id: 'prevent-update-reboot',
    labelKey: 'windowsConfigurations.quickSettings.presets.preventUpdateReboot.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.preventUpdateReboot.description',
    registryPath:
      'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate\\AU\\NoAutoRebootWithLoggedOnUsers',
    type: 'DWORD',
    value: 1,
  },
  {
    id: 'disable-fast-startup',
    labelKey: 'windowsConfigurations.quickSettings.presets.disableFastStartup.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.disableFastStartup.description',
    registryPath: 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power\\HiberbootEnabled',
    type: 'DWORD',
    value: 0,
  },
  {
    id: 'usb-read-only',
    labelKey: 'windowsConfigurations.quickSettings.presets.usbReadOnly.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.usbReadOnly.description',
    registryPath:
      'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\RemovableStorageDevices\\{53f5630d-b6bf-11d0-94f2-00a0c91efb8b}\\Deny_Write',
    type: 'DWORD',
    value: 1,
  },
  {
    id: 'force-defender-rtp',
    labelKey: 'windowsConfigurations.quickSettings.presets.forceDefenderRtp.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.forceDefenderRtp.description',
    registryPath:
      'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection\\DisableRealtimeMonitoring',
    type: 'DWORD',
    value: 0,
  },
  {
    id: 'disable-consumer-features',
    labelKey: 'windowsConfigurations.quickSettings.presets.disableConsumerFeatures.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.disableConsumerFeatures.description',
    registryPath:
      'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent\\DisableWindowsConsumerFeatures',
    type: 'DWORD',
    value: 1,
  },
  {
    id: 'block-microsoft-accounts',
    labelKey: 'windowsConfigurations.quickSettings.presets.blockMicrosoftAccounts.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.blockMicrosoftAccounts.description',
    registryPath:
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\NoConnectedUser',
    type: 'DWORD',
    value: 3,
  },
  {
    id: 'inactivity-lock-15min',
    labelKey: 'windowsConfigurations.quickSettings.presets.inactivityLock15Min.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.inactivityLock15Min.description',
    registryPath:
      'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System\\InactivityTimeoutSecs',
    type: 'DWORD',
    value: 900,
  },
  {
    id: 'disable-llmnr',
    labelKey: 'windowsConfigurations.quickSettings.presets.disableLlmnr.label',
    descriptionKey: 'windowsConfigurations.quickSettings.presets.disableLlmnr.description',
    registryPath: 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\DNSClient\\EnableMulticast',
    type: 'DWORD',
    value: 0,
  },
]
