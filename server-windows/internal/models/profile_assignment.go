package models

// WindowsProfileDevice links a config profile to a specific Windows device.
type WindowsProfileDevice struct {
	ProfileID uint `gorm:"primaryKey"`
	DeviceID  uint `gorm:"primaryKey;index"`
}

func (WindowsProfileDevice) TableName() string {
	return "windows_profile_devices"
}

// WindowsProfileGroup links a config profile to a Windows device group.
type WindowsProfileGroup struct {
	ProfileID uint `gorm:"primaryKey"`
	GroupID   uint `gorm:"primaryKey;index"`
}

func (WindowsProfileGroup) TableName() string {
	return "windows_profile_groups"
}

// AssignConfigProfileRequest replaces profile assignments.
type AssignConfigProfileRequest struct {
	GroupIDs  []uint `json:"groupIds"`
	DeviceIDs []uint `json:"deviceIds"`
}

// ConfigProfileAssignmentsResponse lists current profile assignments.
type ConfigProfileAssignmentsResponse struct {
	GroupIDs  []uint `json:"groupIds"`
	DeviceIDs []uint `json:"deviceIds"`
}
