package models

import (
	"encoding/json"
	"time"
)

const (
	CommandStatusPending   = "pending"
	CommandStatusRunning   = "running"
	CommandStatusCompleted = "completed"
	CommandStatusFailed    = "failed"
)

// WindowsDeviceCommand is a queued remote action for a Windows agent.
type WindowsDeviceCommand struct {
	ID          uint            `gorm:"primaryKey"`
	HardwareID  string          `gorm:"index:idx_windows_commands_device_status,priority:1"`
	Action      string          `gorm:"index"`
	Payload     json.RawMessage `gorm:"type:jsonb"`
	Status      string          `gorm:"index:idx_windows_commands_device_status,priority:2"`
	Result      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CompletedAt *time.Time
}

// TableName pins commands to a dedicated table.
func (WindowsDeviceCommand) TableName() string {
	return "windows_device_commands"
}

// EnqueueCommandRequest is sent by the admin UI.
type EnqueueCommandRequest struct {
	Action      string          `json:"action"`
	CommandName string          `json:"commandName"`
	Payload     json.RawMessage `json:"payload"`
}

// EnqueueCommandResponse confirms command creation.
type EnqueueCommandResponse struct {
	ID     uint   `json:"id"`
	Action string `json:"action"`
	Status string `json:"status"`
}

// PollCommandResponse is returned to the agent when a command is ready.
type PollCommandResponse struct {
	ID      uint            `json:"id"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// CompleteCommandRequest is posted by the agent after execution.
type CompleteCommandRequest struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// LatestCommandResponse is returned to the admin UI for command feedback.
type LatestCommandResponse struct {
	ID          uint       `json:"id"`
	Action      string     `json:"action"`
	Status      string     `json:"status"`
	Result      string     `json:"result,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}
