package models

// ChartItem is a labeled numeric bucket used by dashboard summary responses.
type ChartItem struct {
	StringAttr string `json:"stringAttr"`
	IntAttr    int    `json:"intAttr"`
	Number     int64  `json:"number"`
}

// DashboardSummaryResponse mirrors the Java SummaryResponse consumed by frontend-v2.
type DashboardSummaryResponse struct {
	StatusSummary           []ChartItem `json:"statusSummary"`
	InstallSummary          []ChartItem `json:"installSummary"`
	DevicesTotal            int64       `json:"devicesTotal"`
	DevicesEnrolled         int64       `json:"devicesEnrolled"`
	DevicesEnrolledLastMonth int64      `json:"devicesEnrolledLastMonth"`
	DevicesEnrolledMonthly  []ChartItem `json:"devicesEnrolledMonthly"`
	TopConfigs              []string    `json:"topConfigs"`
	StatusOfflineByConfig   []int64     `json:"statusOfflineByConfig"`
	StatusIdleByConfig      []int64     `json:"statusIdleByConfig"`
	StatusOnlineByConfig    []int64     `json:"statusOnlineByConfig"`
	AppFailureByConfig      []int64     `json:"appFailureByConfig"`
	AppMismatchByConfig     []int64     `json:"appMismatchByConfig"`
	AppSuccessByConfig      []int64     `json:"appSuccessByConfig"`
	Sources                 DashboardSummarySources `json:"sources,omitempty"`
	Warnings                []string    `json:"warnings,omitempty"`
}

type DashboardSummarySources struct {
	Android bool `json:"android"`
	Windows bool `json:"windows"`
}

// DashboardAttentionDevice is one row for the unified attention table.
type DashboardAttentionDevice struct {
	Platform          string `json:"platform"`
	Number            string `json:"number"`
	DisplayName       string `json:"displayName"`
	StatusCode        string `json:"statusCode"`
	LastUpdate        *int64 `json:"lastUpdate,omitempty"`
	ConfigurationName string `json:"configurationName,omitempty"`
}

type DashboardAttentionDevicesResponse struct {
	Items    []DashboardAttentionDevice `json:"items"`
	Sources  DashboardSummarySources      `json:"sources,omitempty"`
	Warnings []string                     `json:"warnings,omitempty"`
}
