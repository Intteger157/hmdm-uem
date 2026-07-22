package models

import "time"

// EnrollRequest is sent by the Windows agent during token-based enrollment.
type EnrollRequest struct {
	EnrollmentToken string `json:"enrollment_token" binding:"required"`
	HardwareID      string `json:"hardware_id" binding:"required"`
}

// EnrollResponse contains the JWT issued after successful enrollment.
type EnrollResponse struct {
	AuthToken string `json:"auth_token"`
}

// InventoryRequest mirrors the inventory payload sent by the Windows agent.
type InventoryRequest struct {
	Hostname     string `json:"hostname"`
	OSVersion    string `json:"os_version"`
	CPU          string `json:"cpu"`
	RAM_GB       int    `json:"ram_gb"`
	DiskTotal_GB int    `json:"disk_total_gb"`
	DiskUsed_GB  int    `json:"disk_used_gb"`
}

// WindowsDevice is the persisted Windows agent record in PostgreSQL.
type WindowsDevice struct {
	ID              uint      `gorm:"primaryKey"`
	HardwareID      string    `gorm:"uniqueIndex"`
	EnrollmentToken string
	Hostname        string
	OSVersion       string
	CPU             string
	RAM_GB          int
	DiskTotal_GB    int
	DiskUsed_GB     int
	LastCheckin     time.Time
}

// TableName pins Windows inventory to a dedicated table, isolated from Java MDM `devices`.
func (WindowsDevice) TableName() string {
	return "windows_devices"
}

// WindowsDeviceJSON is the admin UI list payload for a single Windows agent.
type WindowsDeviceJSON struct {
	ID           uint      `json:"id"`
	HardwareID   string    `json:"hardwareId"`
	Hostname     string    `json:"hostname"`
	OSVersion    string    `json:"osVersion"`
	CPU          string    `json:"cpu"`
	RAM_GB       int       `json:"ramGb"`
	DiskTotal_GB int       `json:"diskTotalGb"`
	DiskUsed_GB  int       `json:"diskUsedGb"`
	LastCheckin  time.Time `json:"lastCheckin"`
}

// WindowsDeviceListResponse is returned by GET /rest/windows/devices.
type WindowsDeviceListResponse struct {
	Items           []WindowsDeviceJSON `json:"items"`
	TotalItemsCount int64               `json:"totalItemsCount"`
}

func ToWindowsDeviceJSON(device WindowsDevice) WindowsDeviceJSON {
	return WindowsDeviceJSON{
		ID:           device.ID,
		HardwareID:   device.HardwareID,
		Hostname:     device.Hostname,
		OSVersion:    device.OSVersion,
		CPU:          device.CPU,
		RAM_GB:       device.RAM_GB,
		DiskTotal_GB: device.DiskTotal_GB,
		DiskUsed_GB:  device.DiskUsed_GB,
		LastCheckin:  device.LastCheckin,
	}
}
