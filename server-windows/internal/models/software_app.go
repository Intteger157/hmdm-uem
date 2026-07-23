package models

import "time"

const (
	AppTypeUpload = "upload"
	AppTypeURL    = "url"
	AppTypeWinget = "winget"

	UpdateFrequencyDaily  = "daily"
	UpdateFrequencyWeekly = "weekly"
)

// SoftwareApp is a deployable Windows application package.
type SoftwareApp struct {
	ID              uint      `gorm:"primaryKey"`
	Name            string    `gorm:"not null"`
	Version         string
	DownloadURL     string
	InstallArgs     string
	AppType         string    `gorm:"not null;default:url"`
	WingetID        string
	AutoUpdate      bool      `gorm:"not null;default:false"`
	UpdateFrequency string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (SoftwareApp) TableName() string {
	return "software_apps"
}

// UploadApplicationResponse is returned by POST /applications/upload.
type UploadApplicationResponse struct {
	URL     string `json:"url"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

// UpsertSoftwareAppRequest is sent by the admin UI to create or update an app.
type UpsertSoftwareAppRequest struct {
	Name            string `json:"name" binding:"required"`
	Version         string `json:"version"`
	DownloadURL     string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
}

// SoftwareAppJSON is one app catalog entry for the admin UI.
type SoftwareAppJSON struct {
	ID              uint      `json:"id"`
	Name            string    `json:"name"`
	Version         string    `json:"version"`
	DownloadURL     string    `json:"downloadUrl"`
	InstallArgs     string    `json:"installArgs"`
	AppType         string    `json:"appType"`
	WingetID        string    `json:"wingetId"`
	AutoUpdate      bool      `json:"autoUpdate"`
	UpdateFrequency string    `json:"updateFrequency"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// SoftwareAppListResponse is returned by GET /apps.
type SoftwareAppListResponse struct {
	Items           []SoftwareAppJSON `json:"items"`
	TotalItemsCount int64             `json:"totalItemsCount"`
}

func ToSoftwareAppJSON(app SoftwareApp) SoftwareAppJSON {
	appType := app.AppType
	if appType == "" {
		appType = AppTypeURL
	}
	return SoftwareAppJSON{
		ID:              app.ID,
		Name:            app.Name,
		Version:         app.Version,
		DownloadURL:     app.DownloadURL,
		InstallArgs:     app.InstallArgs,
		AppType:         appType,
		WingetID:        app.WingetID,
		AutoUpdate:      app.AutoUpdate,
		UpdateFrequency: app.UpdateFrequency,
		CreatedAt:       app.CreatedAt,
		UpdatedAt:       app.UpdatedAt,
	}
}
