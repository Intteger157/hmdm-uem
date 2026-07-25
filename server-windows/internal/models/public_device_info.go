package models

// PublicDeviceInfoResponse is returned by GET /api/public/device-info/:deviceId.
type PublicDeviceInfoResponse struct {
	DeviceID     string `json:"deviceId"`
	Hostname     string `json:"hostname"`
	MDMServer    string `json:"mdmServer"`
	AgentVersion string `json:"agentVersion"`
	LastSyncTime string `json:"lastSyncTime"`
}
