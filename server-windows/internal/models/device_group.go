package models

import "time"

// WindowsDeviceGroup groups Windows devices for policy assignment.
type WindowsDeviceGroup struct {
	ID        uint   `gorm:"primaryKey"`
	Name      string `gorm:"not null;uniqueIndex"`
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (WindowsDeviceGroup) TableName() string {
	return "windows_device_groups"
}

// DeviceGroupJSON is one group for the admin UI.
type DeviceGroupJSON struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

// DeviceGroupListResponse is returned by GET /groups.
type DeviceGroupListResponse struct {
	Items           []DeviceGroupJSON `json:"items"`
	TotalItemsCount int64             `json:"totalItemsCount"`
}

// CreateDeviceGroupRequest creates a Windows device group.
type CreateDeviceGroupRequest struct {
	Name string `json:"name" binding:"required"`
}
