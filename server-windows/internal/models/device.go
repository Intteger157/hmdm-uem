package models

import "time"

// EnrollRequest is sent by the Windows agent during token-based enrollment.
type EnrollRequest struct {
	EnrollmentToken string `json:"enrollment_token" binding:"required"`
	HardwareID      string `json:"hardware_id" binding:"required"`
}

// EnrollResponse contains the JWT issued after successful enrollment.
type EnrollResponse struct {
	AuthToken string `json:"auth_token"`
}

// InventoryRequest mirrors the inventory payload sent by the Windows agent.
type InventoryRequest struct {
	Hostname     string `json:"hostname"`
	OSVersion    string `json:"os_version"`
	CPU          string `json:"cpu"`
	RAM_GB       int    `json:"ram_gb"`
	DiskTotal_GB int    `json:"disk_total_gb"`
	DiskUsed_GB  int    `json:"disk_used_gb"`
}

// WindowsDevice is the persisted Windows agent record in PostgreSQL.
type WindowsDevice struct {
	ID              uint      `gorm:"primaryKey"`
	HardwareID      string    `gorm:"uniqueIndex"`
	EnrollmentToken string
	Hostname        string
	OSVersion       string
	CPU             string
	RAM_GB          int
	DiskTotal_GB    int
	DiskUsed_GB     int
	LastCheckin     time.Time
}
