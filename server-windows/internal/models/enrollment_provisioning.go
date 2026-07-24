package models

import "time"

const (
	EnrollmentModeToken    = "token"
	EnrollmentModePassword = "password"
)

// WindowsEnrollmentProvisioningSettings stores Autopilot bootstrap settings.
type WindowsEnrollmentProvisioningSettings struct {
	ID               uint      `gorm:"primaryKey"`
	CreateLocalAdmin bool      `gorm:"not null;default:false"`
	AdminUsername    string    `gorm:"not null;default:''"`
	AdminPassword    string    `gorm:"not null;default:''"`
	EnrollmentMode   string    `gorm:"not null;default:'token'"`
	EnrollmentSecret string    `gorm:"not null;default:''"`
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

// EnrollmentSecurityResponse is returned by GET /rest/windows/enrollment-security.
type EnrollmentSecurityResponse struct {
	EnrollmentMode   string `json:"enrollmentMode"`
	EnrollmentSecret string `json:"enrollmentSecret"`
}

// UpdateEnrollmentSecurityRequest updates Autopilot enrollment security options.
type UpdateEnrollmentSecurityRequest struct {
	EnrollmentMode   string `json:"enrollmentMode"`
	EnrollmentSecret string `json:"enrollmentSecret"`
}

// BootstrapRegisterRequest is sent by the bootstrap PowerShell script to /api/windows/register.
type BootstrapRegisterRequest struct {
	EnrollmentSecret string `json:"enrollment_secret"`
}

// BootstrapRegisterResponse returns the org enrollment token after secret validation.
type BootstrapRegisterResponse struct {
	EnrollmentToken string `json:"enrollment_token"`
}
