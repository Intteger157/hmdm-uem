package models

import "time"

// WindowsEnrollmentToken is a one-time (or device-bound) token issued by the admin UI.
type WindowsEnrollmentToken struct {
	ID         uint       `gorm:"primaryKey"`
	Token      string     `gorm:"uniqueIndex;not null"`
	CreatedAt  time.Time  `gorm:"not null"`
	UsedAt     *time.Time
	UsedByHWID string
}

func (WindowsEnrollmentToken) TableName() string {
	return "windows_enrollment_tokens"
}

// EnrollmentTokenResponse is returned by POST /rest/windows/enrollment-token.
type EnrollmentTokenResponse struct {
	Token string `json:"token"`
}
