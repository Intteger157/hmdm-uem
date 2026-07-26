package models

import "time"

// ProfileFileDeployment links a config profile to a file deployment rule.
type ProfileFileDeployment struct {
	ID               uint   `gorm:"primaryKey"`
	ProfileID        uint   `gorm:"index;not null"`
	FileID           uint   `gorm:"index;not null"`
	DestinationPath  string `gorm:"not null"`
	Unzip            bool   `gorm:"not null;default:false"`
	PostActionScript string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (ProfileFileDeployment) TableName() string {
	return "profile_file_deployments"
}

// ProfileFileDeploymentRule is one editable deployment rule for the admin UI.
type ProfileFileDeploymentRule struct {
	ID               uint   `json:"id,omitempty"`
	FileID           uint   `json:"fileId" binding:"required"`
	DestinationPath  string `json:"destinationPath" binding:"required"`
	Unzip            bool   `json:"unzip"`
	PostActionScript string `json:"postActionScript,omitempty"`
}

// ProfileFileDeploymentsResponse lists deployment rules for a profile.
type ProfileFileDeploymentsResponse struct {
	Items []ProfileFileDeploymentRule `json:"items"`
}

// AssignProfileFileDeploymentsRequest replaces deployment rules for a profile.
type AssignProfileFileDeploymentsRequest struct {
	Items []ProfileFileDeploymentRule `json:"items"`
}

// FileDeployment is one file deployment rule delivered to the agent.
type FileDeployment struct {
	ID               uint      `json:"id"`
	FileID           uint      `json:"fileId"`
	OriginalName     string    `json:"originalName"`
	DownloadURL      string    `json:"downloadUrl"`
	SizeBytes        int64     `json:"sizeBytes"`
	SHA256           string    `json:"sha256"`
	DestinationPath  string    `json:"destinationPath"`
	Unzip            bool      `json:"unzip"`
	PostActionScript string    `json:"postActionScript,omitempty"`
	UpdatedAt        time.Time `json:"updatedAt"`
}
