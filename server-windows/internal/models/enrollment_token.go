package models

import "time"

// WindowsEnrollmentToken is a one-time (or device-bound) token issued by the admin UI.
type WindowsEnrollmentToken struct {
	ID                uint       `gorm:"primaryKey"`
	Token             string     `gorm:"uniqueIndex;not null"`
	CreatedAt         time.Time  `gorm:"not null"`
	UsedAt            *time.Time
	UsedByHWID        string
	DownloadToken     *string    `gorm:"uniqueIndex"`
	InstallerPath     string
	InstallerFileName string
	PermanentFileURL  string
	DownloadUsedAt    *time.Time
}

func (WindowsEnrollmentToken) TableName() string {
	return "windows_enrollment_tokens"
}

// EnrollmentTokenResponse is returned by POST /rest/windows/enrollment-token.
type EnrollmentTokenResponse struct {
	Token string `json:"token"`
}

// LinkInstallerRequest binds an uploaded MSI file to an enrollment token.
type LinkInstallerRequest struct {
	EnrollmentToken   string `json:"enrollmentToken" binding:"required"`
	FilesRelativePath string `json:"filesRelativePath" binding:"required"`
	FileName          string `json:"fileName" binding:"required"`
	PermanentFileURL  string `json:"permanentFileUrl" binding:"required"`
}

// LinkInstallerResponse contains one-time and permanent download URLs.
type LinkInstallerResponse struct {
	DownloadURL      string `json:"downloadUrl"`
	PermanentFileURL string `json:"permanentFileUrl"`
	DownloadToken    string `json:"downloadToken"`
}
