package models

// WindowsDeviceApp links a device to a directly assigned software app.
type WindowsDeviceApp struct {
	DeviceID uint `gorm:"primaryKey"`
	AppID    uint `gorm:"primaryKey;index"`
}

func (WindowsDeviceApp) TableName() string {
	return "windows_device_apps"
}
