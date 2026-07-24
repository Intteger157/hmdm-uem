package models

import "time"

// AutopilotAgentStatus describes the bootstrap agent binary published for zero-touch enrollment.
type AutopilotAgentStatus struct {
	Configured  bool      `json:"configured"`
	FileName    string    `json:"fileName,omitempty"`
	FileSize    int64     `json:"fileSize,omitempty"`
	Version     string    `json:"version,omitempty"`
	ProductName string    `json:"productName,omitempty"`
	UploadedAt  time.Time `json:"uploadedAt,omitempty"`
	PublicURL   string    `json:"publicUrl,omitempty"`
}
