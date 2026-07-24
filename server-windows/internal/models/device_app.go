package models

// WindowsDeviceApp links a device to a directly assigned application.
type WindowsDeviceApp struct {
	DeviceID  uint  `gorm:"primaryKey"`
	AppID     uint  `gorm:"primaryKey;index"`
	VersionID *uint `gorm:"index"` // nil = latest active version
}

func (WindowsDeviceApp) TableName() string {
	return "windows_device_apps"
}

// AssignDeviceAppRequest optionally pins a version for direct deployment.
type AssignDeviceAppRequest struct {
	VersionID *uint `json:"versionId,omitempty"`
}
