package models

import "time"

// WindowsEnrollmentProvisioningSettings stores Autopilot bootstrap provisioning options.
type WindowsEnrollmentProvisioningSettings struct {
	ID               uint      `gorm:"primaryKey"`
	CreateLocalAdmin bool      `gorm:"not null;default:false"`
	AdminUsername    string    `gorm:"not null;default:''"`
	AdminPassword    string    `gorm:"not null;default:''"`
	UpdatedAt        time.Time `gorm:"not null"`
}

func (WindowsEnrollmentProvisioningSettings) TableName() string {
	return "windows_enrollment_provisioning_settings"
}

// EnrollmentProvisioningResponse is returned by GET /rest/windows/enrollment-provisioning.
type EnrollmentProvisioningResponse struct {
	CreateLocalAdmin bool   `json:"createLocalAdmin"`
	AdminUsername    string `json:"adminUsername"`
	AdminPassword    string `json:"adminPassword"`
}

// UpdateEnrollmentProvisioningRequest updates Autopilot bootstrap provisioning options.
type UpdateEnrollmentProvisioningRequest struct {
	CreateLocalAdmin bool   `json:"createLocalAdmin"`
	AdminUsername    string `json:"adminUsername"`
	AdminPassword    string `json:"adminPassword"`
}
