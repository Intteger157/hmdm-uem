package models

// PublicDeviceResponse is returned by GET /api/public/device-info/:deviceId.
// JSON keys use snake_case for stable public API contracts.
type PublicDeviceResponse struct {
	DeviceID     string `json:"device_id"`
	Hostname     string `json:"hostname"`
	Manufacturer string `json:"manufacturer"`
	Model        string `json:"model"`
	AgentVersion string `json:"agent_version"`
	LastSync     string `json:"last_sync"`
	MDMServer    string `json:"mdm_server"`
}

// PublicDeviceInfoResponse is deprecated; kept as alias for internal references during migration.
type PublicDeviceInfoResponse = PublicDeviceResponse
