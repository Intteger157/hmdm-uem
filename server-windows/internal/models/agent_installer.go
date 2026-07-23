package models

import "time"

// WindowsAgentInstaller stores the single universal agent MSI uploaded by admin.
type WindowsAgentInstaller struct {
	ID                uint      `gorm:"primaryKey"`
	FilesRelativePath string    `gorm:"not null"`
	FileName          string    `gorm:"not null"`
	PermanentFileURL  string    `gorm:"not null"`
	CreatedAt         time.Time `gorm:"not null"`
}

func (WindowsAgentInstaller) TableName() string {
	return "windows_agent_installer"
}

// RegisterDefaultInstallerRequest registers the shared agent MSI (built once).
type RegisterDefaultInstallerRequest struct {
	FilesRelativePath string `json:"filesRelativePath" binding:"required"`
	FileName          string `json:"fileName" binding:"required"`
	PermanentFileURL  string `json:"permanentFileUrl" binding:"required"`
}

// DefaultInstallerResponse describes the shared agent MSI.
type DefaultInstallerResponse struct {
	Configured       bool   `json:"configured"`
	FilesRelativePath string `json:"filesRelativePath,omitempty"`
	FileName         string `json:"fileName,omitempty"`
	PermanentFileURL string `json:"permanentFileUrl,omitempty"`
}
