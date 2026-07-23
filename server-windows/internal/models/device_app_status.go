package models

import "time"

const (
	AppStatusPending     = "Pending"
	AppStatusDownloading = "Downloading"
	AppStatusInstalling  = "Installing"
	AppStatusSuccess     = "Success"
	AppStatusFailed      = "Failed"
)

// DeviceAppStatus tracks deployment progress for one app on one device.
type DeviceAppStatus struct {
	ID           uint      `gorm:"primaryKey"`
	DeviceID     uint      `gorm:"not null;uniqueIndex:idx_device_app_status"`
	AppID        uint      `gorm:"not null;uniqueIndex:idx_device_app_status"`
	Status       string    `gorm:"not null"`
	ErrorMessage string
	UpdatedAt    time.Time
}

func (DeviceAppStatus) TableName() string {
	return "device_app_statuses"
}

// ReportDeviceAppStatusRequest is sent by the agent during app deployment.
type ReportDeviceAppStatusRequest struct {
	AppID  uint   `json:"appId" binding:"required"`
	Status string `json:"status" binding:"required"`
	Error  string `json:"error"`
}

// DeviceAppStatusJSON is one app deployment status for the admin UI.
type DeviceAppStatusJSON struct {
	AppID        uint      `json:"appId"`
	AppName      string    `json:"appName"`
	AppVersion   string    `json:"appVersion"`
	Status       string    `json:"status"`
	ErrorMessage string    `json:"errorMessage,omitempty"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// DeviceAppStatusListResponse is returned by GET /devices/:id/apps/status.
type DeviceAppStatusListResponse struct {
	Items         []DeviceAppStatusJSON `json:"items"`
	RequiredTotal int                   `json:"requiredTotal"`
}
