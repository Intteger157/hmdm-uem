package models

const CommandNameFileDeployment = "FileDeployment"

// ReportFileDeploymentLogRequest is posted by the agent after deploying a file rule.
type ReportFileDeploymentLogRequest struct {
	DeploymentID uint   `json:"deploymentId" binding:"required"`
	FileID       uint   `json:"fileId" binding:"required"`
	FileName     string `json:"fileName"`
	Status       string `json:"status" binding:"required"`
	Output       string `json:"output"`
}
