export interface ChartItem {
  stringAttr: string
  intAttr: number
  number: number
}

export interface SummaryResponse {
  statusSummary: ChartItem[]
  installSummary: ChartItem[]
  devicesTotal: number
  devicesEnrolled: number
  devicesEnrolledLastMonth: number
  devicesEnrolledMonthly: ChartItem[]
  topConfigs: string[]
  statusOfflineByConfig: number[]
  statusIdleByConfig: number[]
  statusOnlineByConfig: number[]
  appFailureByConfig: number[]
  appMismatchByConfig: number[]
  appSuccessByConfig: number[]
  sources?: {
    android: boolean
    windows: boolean
  }
  warnings?: string[]
}

export interface SummaryFetchResult {
  summary: SummaryResponse
  warnings: string[]
}
