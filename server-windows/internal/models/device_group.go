package models

import "time"

// WindowsDeviceGroup groups Windows devices for policy assignment.
type WindowsDeviceGroup struct {
	ID          uint   `gorm:"primaryKey"`
	Name        string `gorm:"not null;uniqueIndex"`
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (WindowsDeviceGroup) TableName() string {
	return "windows_device_groups"
}

// DeviceGroupJSON is one group for the admin UI.
type DeviceGroupJSON struct {
	ID                uint   `json:"id"`
	Name              string `json:"name"`
	Description       string `json:"description,omitempty"`
	DeviceCount       int64  `json:"deviceCount"`
	DeviceIDs         []uint `json:"deviceIds,omitempty"`
	ConfigurationID   uint   `json:"configurationId,omitempty"`
	ConfigurationName string `json:"configurationName,omitempty"`
}

// DeviceGroupListResponse is returned by GET /groups.
type DeviceGroupListResponse struct {
	Items           []DeviceGroupJSON `json:"items"`
	TotalItemsCount int64             `json:"totalItemsCount"`
}

// DeviceGroupAssignmentPayload is shared by create and update requests.
type DeviceGroupAssignmentPayload struct {
	ConfigurationID *uint  `json:"configurationId"`
	DeviceIDs       []uint `json:"deviceIds"`
}

// CreateDeviceGroupRequest creates a Windows device group.
type CreateDeviceGroupRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	DeviceGroupAssignmentPayload
}

// UpdateDeviceGroupRequest updates a Windows device group.
type UpdateDeviceGroupRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	DeviceGroupAssignmentPayload
}
