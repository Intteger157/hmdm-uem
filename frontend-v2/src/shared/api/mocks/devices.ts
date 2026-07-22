import type {
  ConfigurationView,
  DeviceListView,
  DeviceSearchParams,
  DeviceView,
} from '@/shared/api/types/device'
import type { InstalledSoftware, LocalUser } from '@/shared/api/types/device-detail'
import { mockNetworkDelay } from '@/shared/api/mock-utils'

const now = Date.now()
const hour = 3_600_000
const day = 86_400_000

export const MOCK_CONFIGURATIONS: Record<string, ConfigurationView> = {
  '1': { id: 1, name: 'Warehouse Kiosk' },
  '2': { id: 2, name: 'Field Sales' },
  '3': { id: 3, name: 'Corporate Standard' },
  '4': { id: 4, name: 'Windows Office' },
}

const BASE_MOCK_DEVICES: DeviceView[] = [
  {
    id: 101,
    platform: 'android',
    configurationId: 1,
    number: 'AND-001',
    description: 'Samsung Galaxy A54 — front desk',
    lastUpdate: now - 12 * 60_000,
    imei: '359012345678901',
    androidVersion: '14',
    launcherVersion: '5.39.2',
    statusCode: 'green',
    mdmMode: true,
    kioskMode: false,
    enrollTime: now - 120 * day,
    info: { model: 'SM-A546B', batteryLevel: 87, mdmMode: true, defaultLauncher: true },
    groups: [{ id: 1, name: 'Retail' }],
  },
  {
    id: 102,
    platform: 'android',
    configurationId: 2,
    number: 'AND-002',
    description: 'Xiaomi Redmi Note 12 — sales rep',
    lastUpdate: now - 45 * 60_000,
    imei: '861234567890123',
    androidVersion: '13',
    launcherVersion: '5.38.0',
    statusCode: 'yellow',
    mdmMode: true,
    info: { model: '23021RAA2Y', batteryLevel: 23, mdmMode: true },
    groups: [{ id: 2, name: 'Sales' }],
  },
  {
    id: 103,
    platform: 'android',
    configurationId: 1,
    number: 'AND-003',
    description: 'Honeywell CT60 — scanner pool',
    lastUpdate: now - 5 * 60_000,
    imei: '357890123456789',
    androidVersion: '11',
    launcherVersion: '5.39.2',
    statusCode: 'green',
    mdmMode: true,
    kioskMode: true,
    info: { model: 'CT60-L1N', batteryLevel: 64, mdmMode: true, kioskMode: true },
  },
  {
    id: 104,
    platform: 'android',
    configurationId: 2,
    number: 'AND-004',
    description: 'Zebra TC52 — offline unit',
    lastUpdate: now - 26 * hour,
    imei: '354567890123456',
    androidVersion: '10',
    launcherVersion: '5.35.1',
    statusCode: 'red',
    mdmMode: true,
    info: { model: 'TC520K', batteryLevel: 0, mdmMode: true },
  },
  {
    id: 105,
    platform: 'android',
    configurationId: 3,
    number: 'AND-005',
    description: 'Google Pixel 8 — QA device',
    lastUpdate: now - 2 * 60_000,
    imei: '351234567890987',
    androidVersion: '15',
    launcherVersion: '5.39.2',
    statusCode: 'green',
    mdmMode: true,
    info: { model: 'Pixel 8', batteryLevel: 100, mdmMode: true, defaultLauncher: true },
  },
  {
    id: 106,
    platform: 'android',
    configurationId: 1,
    number: 'AND-006',
    description: 'Lenovo Tab M10 — showroom',
    lastUpdate: now - 3 * hour,
    androidVersion: '12',
    launcherVersion: '5.37.0',
    statusCode: 'brown',
    mdmMode: true,
    info: { model: 'TB-X606F', batteryLevel: 41, mdmMode: true },
  },
  {
    id: 107,
    platform: 'android',
    configurationId: 2,
    number: 'AND-007',
    description: 'Samsung XCover6 Pro — field engineer',
    lastUpdate: now - 18 * 60_000,
    imei: '358901234567890',
    androidVersion: '14',
    launcherVersion: '5.39.2',
    statusCode: 'green',
    mdmMode: true,
    info: { model: 'SM-G736B', batteryLevel: 72, mdmMode: true },
  },
  {
    id: 108,
    platform: 'android',
    configurationId: 3,
    number: 'AND-008',
    description: 'Generic tablet — spare inventory',
    lastUpdate: 0,
    androidVersion: '9',
    launcherVersion: '5.20.0',
    statusCode: 'grey',
    mdmMode: false,
    info: { model: 'Unknown', batteryLevel: 15 },
  },
  {
    id: 109,
    platform: 'android',
    configurationId: 2,
    number: 'AND-009',
    description: 'Huawei MatePad — training room',
    lastUpdate: now - 90 * 60_000,
    androidVersion: '12',
    launcherVersion: '5.36.0',
    statusCode: 'yellow',
    mdmMode: true,
    info: { model: 'BAH3-W09', batteryLevel: 55, mdmMode: true },
  },
  {
    id: 201,
    platform: 'windows',
    configurationId: 4,
    number: 'WIN-001',
    description: 'HR laptop — onboarding',
    hostname: 'HR-LAPTOP-01',
    windowsBuild: '22631.3880',
    bitlockerStatus: 'on',
    powershellExecStatus: 'idle',
    lastUpdate: now - 8 * 60_000,
    statusCode: 'green',
    publicIp: '192.168.10.45',
  },
  {
    id: 202,
    platform: 'windows',
    configurationId: 4,
    number: 'WIN-002',
    description: 'Operations workstation',
    hostname: 'OPS-WS-014',
    windowsBuild: '26100.1742',
    bitlockerStatus: 'off',
    powershellExecStatus: 'idle',
    lastUpdate: now - 55 * 60_000,
    statusCode: 'yellow',
    publicIp: '192.168.20.14',
  },
  {
    id: 203,
    platform: 'windows',
    configurationId: 1,
    number: 'WIN-003',
    description: 'Kiosk PC — lobby display',
    hostname: 'KIOSK-LOBBY-03',
    windowsBuild: '22631.3527',
    bitlockerStatus: 'on',
    powershellExecStatus: 'running',
    lastUpdate: now - 3 * 60_000,
    statusCode: 'green',
    kioskMode: true,
  },
  {
    id: 204,
    platform: 'windows',
    configurationId: 3,
    number: 'WIN-004',
    description: 'Finance department PC',
    hostname: 'FIN-PC-008',
    windowsBuild: '19045.5247',
    bitlockerStatus: 'unknown',
    powershellExecStatus: 'idle',
    lastUpdate: now - 6 * hour,
    statusCode: 'brown',
  },
  {
    id: 205,
    platform: 'windows',
    configurationId: 4,
    number: 'WIN-005',
    description: 'Developer machine — scripts test',
    hostname: 'DEV-WS-007',
    windowsBuild: '22635.4000',
    bitlockerStatus: 'on',
    powershellExecStatus: 'failed',
    lastUpdate: now - 20 * 60_000,
    statusCode: 'red',
    publicIp: '10.0.0.107',
  },
]

const WINDOWS_SOFTWARE: Record<number, InstalledSoftware[]> = {
  201: [
    { name: 'Microsoft 365 Apps', version: '16.0.18025', publisher: 'Microsoft Corporation', installDate: '2025-11-12' },
    { name: 'Google Chrome', version: '122.0.6261.112', publisher: 'Google LLC', installDate: '2026-01-08' },
    { name: 'Zoom Workplace', version: '6.0.10', publisher: 'Zoom Video Communications', installDate: '2025-09-20' },
    { name: 'CrowdStrike Falcon', version: '7.14.180', publisher: 'CrowdStrike', installDate: '2025-08-01' },
  ],
  202: [
    { name: 'Microsoft Teams', version: '24124.2402', publisher: 'Microsoft Corporation', installDate: '2026-02-01' },
    { name: '7-Zip', version: '24.08', publisher: 'Igor Pavlov', installDate: '2024-06-15' },
    { name: 'PuTTY', version: '0.81', publisher: 'Simon Tatham', installDate: '2025-03-22' },
    { name: 'Notepad++', version: '8.6.7', publisher: 'Notepad++ Team', installDate: '2025-12-05' },
    { name: 'Slack', version: '4.39.90', publisher: 'Slack Technologies', installDate: '2026-01-14' },
  ],
  203: [
    { name: 'Headwind MDM Agent', version: '1.2.0', publisher: 'Headwind MDM', installDate: '2026-03-01' },
    { name: 'Google Chrome', version: '121.0.6167.184', publisher: 'Google LLC', installDate: '2026-02-18' },
  ],
  204: [
    { name: 'Microsoft Excel', version: '16.0.17928', publisher: 'Microsoft Corporation', installDate: '2025-10-30' },
    { name: 'SAP GUI', version: '8000.1.4', publisher: 'SAP SE', installDate: '2025-07-19' },
    { name: 'Adobe Acrobat Reader', version: '24.003.20112', publisher: 'Adobe Inc.', installDate: '2025-05-11' },
  ],
  205: [
    { name: 'Visual Studio Code', version: '1.87.2', publisher: 'Microsoft Corporation', installDate: '2026-01-20' },
    { name: 'Docker Desktop', version: '4.28.0', publisher: 'Docker Inc.', installDate: '2025-12-12' },
    { name: 'Windows Terminal', version: '1.19.103', publisher: 'Microsoft Corporation', installDate: '2026-02-05' },
    { name: 'Git', version: '2.44.0', publisher: 'The Git Development Community', installDate: '2025-11-02' },
    { name: 'Node.js', version: '20.11.1', publisher: 'OpenJS Foundation', installDate: '2026-01-05' },
    { name: 'Postman', version: '11.24.0', publisher: 'Postman Inc.', installDate: '2025-08-28' },
  ],
}

const WINDOWS_USERS: Record<number, LocalUser[]> = {
  201: [
    { username: 'hr.user', isAdmin: false, status: 'active' },
    { username: 'localadmin', isAdmin: true, status: 'active' },
    { username: 'guest', isAdmin: false, status: 'disabled' },
  ],
  202: [
    { username: 'ops.tech', isAdmin: false, status: 'active' },
    { username: 'Administrator', isAdmin: true, status: 'active' },
    { username: 'backup_svc', isAdmin: false, status: 'active' },
  ],
  203: [
    { username: 'kiosk', isAdmin: false, status: 'active' },
    { username: 'svc-display', isAdmin: false, status: 'active' },
  ],
  204: [
    { username: 'finance.analyst', isAdmin: false, status: 'active' },
    { username: 'fin.admin', isAdmin: true, status: 'locked' },
    { username: 'Guest', isAdmin: false, status: 'disabled' },
  ],
  205: [
    { username: 'dev.user', isAdmin: false, status: 'active' },
    { username: 'Administrator', isAdmin: true, status: 'active' },
    { username: 'docker-user', isAdmin: false, status: 'active' },
    { username: 'test', isAdmin: false, status: 'disabled' },
  ],
}

const WINDOWS_HARDWARE: Record<number, Partial<DeviceView>> = {
  201: {
    serialNumber: 'PF4ABC12',
    manufacturer: 'Lenovo',
    model: 'ThinkPad E14 Gen 5',
    cpu: 'Intel Core i5-1335U',
    ramGb: 16,
    diskTotalGb: 512,
    diskUsedGb: 287,
    diskEncrypted: true,
    currentUser: 'CORP\\hr.user',
  },
  202: {
    serialNumber: 'DL8XYZ99',
    manufacturer: 'Dell',
    model: 'OptiPlex 7090',
    cpu: 'Intel Core i7-11700',
    ramGb: 32,
    diskTotalGb: 1024,
    diskUsedGb: 640,
    diskEncrypted: false,
    currentUser: 'CORP\\ops.tech',
  },
  203: {
    serialNumber: 'HP9KIOSK01',
    manufacturer: 'HP',
    model: 'ProOne 440 G9',
    cpu: 'Intel Core i5-12500',
    ramGb: 8,
    diskTotalGb: 256,
    diskUsedGb: 98,
    diskEncrypted: true,
    currentUser: 'CORP\\kiosk',
  },
  204: {
    serialNumber: 'FIN20488',
    manufacturer: 'HP',
    model: 'EliteDesk 800 G6',
    cpu: 'Intel Core i5-10500',
    ramGb: 16,
    diskTotalGb: 512,
    diskUsedGb: 401,
    diskEncrypted: false,
    currentUser: 'CORP\\finance.analyst',
  },
  205: {
    serialNumber: 'DEV00742',
    manufacturer: 'Custom Build',
    model: 'Workstation Pro',
    cpu: 'AMD Ryzen 7 7700X',
    ramGb: 64,
    diskTotalGb: 2048,
    diskUsedGb: 1120,
    diskEncrypted: true,
    currentUser: 'CORP\\dev.user',
  },
}

const ANDROID_DETAIL: Record<number, Partial<DeviceView>> = {
  101: {
    serialNumber: 'R5CR30ABCDE',
    manufacturer: 'Samsung',
    model: 'Galaxy A54 5G',
    currentUser: 'device_owner',
    installedSoftware: [
      { name: 'Headwind MDM', version: '5.39.2', publisher: 'Headwind MDM', installDate: '2025-06-01' },
      { name: 'Chrome', version: '122.0.6261.64', publisher: 'Google LLC', installDate: '2026-01-10' },
    ],
    localUsers: [{ username: 'owner', isAdmin: true, status: 'active' }],
  },
}

function enrichDeviceDetail(device: DeviceView): DeviceView {
  if (device.platform === 'windows') {
    return {
      ...device,
      ...WINDOWS_HARDWARE[device.id],
      diskEncrypted: WINDOWS_HARDWARE[device.id]?.diskEncrypted ?? device.bitlockerStatus === 'on',
      installedSoftware: WINDOWS_SOFTWARE[device.id] ?? [],
      localUsers: WINDOWS_USERS[device.id] ?? [],
    }
  }

  const androidExtra = ANDROID_DETAIL[device.id]
  return {
    ...device,
    serialNumber: device.serial ?? device.info?.serial,
    manufacturer: androidExtra?.manufacturer ?? 'Unknown',
    model: device.info?.model ?? androidExtra?.model,
    currentUser: androidExtra?.currentUser ?? 'owner',
    installedSoftware: androidExtra?.installedSoftware ?? [
      { name: 'Headwind MDM', version: device.launcherVersion ?? '5.39.2', publisher: 'Headwind MDM', installDate: '2025-01-01' },
    ],
    localUsers: androidExtra?.localUsers ?? [{ username: 'owner', isAdmin: true, status: 'active' }],
  }
}

export const MOCK_DEVICES: DeviceView[] = BASE_MOCK_DEVICES

export function getMockDeviceById(id: number): DeviceView | undefined {
  const base = BASE_MOCK_DEVICES.find((d) => d.id === id)
  if (!base) return undefined
  return enrichDeviceDetail(base)
}

function matchesSearch(device: DeviceView, value: string): boolean {
  const q = value.toLowerCase()
  const fields = [
    device.number,
    device.description,
    device.imei,
    device.hostname,
    device.info?.model,
    device.androidVersion,
    device.windowsBuild,
  ]
  return fields.some((f) => f?.toLowerCase().includes(q))
}

function collectConfigurations(devices: DeviceView[]): Record<string, ConfigurationView> {
  const map: Record<string, ConfigurationView> = {}
  for (const device of devices) {
    const key = String(device.configurationId)
    if (!map[key]) {
      map[key] = MOCK_CONFIGURATIONS[key] ?? {
        id: device.configurationId,
        name: `Config #${device.configurationId}`,
      }
    }
  }
  return map
}

export async function mockSearchDevices(params: DeviceSearchParams): Promise<DeviceListView> {
  await mockNetworkDelay()

  let filtered = MOCK_DEVICES.filter((d) => d.platform === params.platform)

  if (params.value?.trim()) {
    filtered = filtered.filter((d) => matchesSearch(d, params.value!.trim()))
  }

  filtered = [...filtered].sort((a, b) => (b.lastUpdate ?? 0) - (a.lastUpdate ?? 0))

  const totalItemsCount = filtered.length
  const pageSize = params.pageSize
  const pageNum = params.pageNum
  const start = (pageNum - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return {
    configurations: collectConfigurations(filtered),
    devices: {
      items,
      totalItemsCount,
    },
  }
}

export async function mockGetDeviceById(id: number): Promise<DeviceView | null> {
  await mockNetworkDelay()
  const device = getMockDeviceById(id)
  return device ?? null
}
