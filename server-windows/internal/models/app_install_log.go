package models

const CommandNameAppInstall = "AppInstall"

// ReportAppInstallLogRequest is posted by the agent during app deployment.
type ReportAppInstallLogRequest struct {
	AppID   uint   `json:"appId" binding:"required"`
	AppName string `json:"appName"`
	Status  string `json:"status" binding:"required"`
	Output  string `json:"output"`
}
