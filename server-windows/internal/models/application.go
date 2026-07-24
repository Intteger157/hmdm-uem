package models

import "time"

const (
	AppTypeUpload = "upload"
	AppTypeURL    = "url"
	AppTypeWinget = "winget"

	UpdateFrequencyDaily  = "daily"
	UpdateFrequencyWeekly = "weekly"
)

// Application is a logical Windows software product in the catalog.
type Application struct {
	ID          uint      `gorm:"primaryKey"`
	Name        string    `gorm:"not null;uniqueIndex"`
	Publisher   string
	Description string
	CreatedAt   time.Time
}

func (Application) TableName() string {
	return "windows_applications"
}

// ApplicationVersion is one deployable package revision for an application.
type ApplicationVersion struct {
	ID              uint      `gorm:"primaryKey"`
	AppID           uint      `gorm:"not null;index"`
	Version         string
	FileURL         string    `gorm:"column:file_url"`
	InstallArgs     string
	AppType         string    `gorm:"not null;default:upload"`
	WingetID        string
	AutoUpdate      bool      `gorm:"not null;default:false"`
	UpdateFrequency string
	IsActive        bool      `gorm:"not null;default:true"`
	UploadedAt      time.Time
	UpdatedAt       time.Time
}

func (ApplicationVersion) TableName() string {
	return "windows_application_versions"
}

// UploadApplicationResponse is returned by POST /applications/upload.
type UploadApplicationResponse struct {
	URL          string `json:"url"`
	Name         string `json:"name"`
	Version      string `json:"version"`
	DetectedArgs string `json:"detectedArgs"`
	AppID        uint   `json:"appId"`
	VersionID    uint   `json:"versionId"`
	IsNewApp     bool   `json:"isNewApp"`
}

// UpdateApplicationRequest updates application metadata.
type UpdateApplicationRequest struct {
	Name        string `json:"name" binding:"required"`
	Publisher   string `json:"publisher"`
	Description string `json:"description"`
}

// CreateApplicationRequest creates an application with its first version.
type CreateApplicationRequest struct {
	Name        string `json:"name" binding:"required"`
	Publisher   string `json:"publisher"`
	Description string `json:"description"`
	CreateApplicationVersionRequest
}

// CreateApplicationVersionRequest creates a non-upload version (URL/winget).
type CreateApplicationVersionRequest struct {
	Version         string `json:"version"`
	FileURL         string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
}

// ApplicationVersionJSON is one version row for the admin UI.
type ApplicationVersionJSON struct {
	ID              uint      `json:"id"`
	AppID           uint      `json:"appId"`
	Version         string    `json:"version"`
	DownloadURL     string    `json:"downloadUrl"`
	InstallArgs     string    `json:"installArgs"`
	AppType         string    `json:"appType"`
	WingetID        string    `json:"wingetId"`
	AutoUpdate      bool      `json:"autoUpdate"`
	UpdateFrequency string    `json:"updateFrequency"`
	IsActive        bool      `json:"isActive"`
	UploadedAt      time.Time `json:"uploadedAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// ApplicationJSON is one catalog application with its versions.
type ApplicationJSON struct {
	ID              uint                     `json:"id"`
	Name            string                   `json:"name"`
	Publisher       string                   `json:"publisher"`
	Description     string                   `json:"description"`
	CreatedAt       time.Time                `json:"createdAt"`
	LatestVersion   string                   `json:"latestVersion"`
	LatestVersionID uint                     `json:"latestVersionId"`
	Versions        []ApplicationVersionJSON `json:"versions"`
}

// ApplicationListResponse is returned by GET /apps.
type ApplicationListResponse struct {
	Items           []ApplicationJSON `json:"items"`
	TotalItemsCount int64             `json:"totalItemsCount"`
}

func ToApplicationVersionJSON(version ApplicationVersion) ApplicationVersionJSON {
	appType := version.AppType
	if appType == "" {
		appType = AppTypeURL
	}
	return ApplicationVersionJSON{
		ID:              version.ID,
		AppID:           version.AppID,
		Version:         version.Version,
		DownloadURL:     version.FileURL,
		InstallArgs:     version.InstallArgs,
		AppType:         appType,
		WingetID:        version.WingetID,
		AutoUpdate:      version.AutoUpdate,
		UpdateFrequency: version.UpdateFrequency,
		IsActive:        version.IsActive,
		UploadedAt:      version.UploadedAt,
		UpdatedAt:       version.UpdatedAt,
	}
}

func ToApplicationJSON(app Application, versions []ApplicationVersion) ApplicationJSON {
	versionItems := make([]ApplicationVersionJSON, 0, len(versions))
	var latest ApplicationVersion
	for _, version := range versions {
		versionItems = append(versionItems, ToApplicationVersionJSON(version))
		if version.IsActive && (latest.ID == 0 || version.UploadedAt.After(latest.UploadedAt)) {
			latest = version
		}
	}
	if latest.ID == 0 && len(versions) > 0 {
		latest = versions[0]
	}

	return ApplicationJSON{
		ID:              app.ID,
		Name:            app.Name,
		Publisher:       app.Publisher,
		Description:     app.Description,
		CreatedAt:       app.CreatedAt,
		LatestVersion:   latest.Version,
		LatestVersionID: latest.ID,
		Versions:        versionItems,
	}
}
