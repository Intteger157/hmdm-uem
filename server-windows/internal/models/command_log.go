package models

import "time"

const (
	CommandLogStatusPending = "Pending"
	CommandLogStatusSuccess = "Success"
	CommandLogStatusFailed  = "Failed"
)

const CommandNameUninstallUpdate = "UninstallUpdate"

// DeviceCommandLog stores queued and completed remote commands with raw agent output.
type DeviceCommandLog struct {
	ID          uint       `gorm:"primaryKey"`
	DeviceID    string     `gorm:"index"`
	CommandName string     `gorm:"index"`
	Payload     string
	Status      string `gorm:"index"`
	Output      string `gorm:"type:text"`
	CreatedAt   time.Time
	ExecutedAt  *time.Time
}

func (DeviceCommandLog) TableName() string {
	return "device_command_logs"
}

// EnqueueDeviceCommandRequest is sent by the admin UI to queue a logged command.
type EnqueueDeviceCommandRequest struct {
	CommandName string `json:"commandName" binding:"required"`
	Payload     string `json:"payload" binding:"required"`
}

// EnqueueDeviceCommandResponse confirms command log creation.
type EnqueueDeviceCommandResponse struct {
	ID          uint   `json:"id"`
	CommandName string `json:"commandName"`
	Payload     string `json:"payload"`
	Status      string `json:"status"`
}

// PendingDeviceCommand is delivered to the agent during inventory check-in.
type PendingDeviceCommand struct {
	ID          uint   `json:"id"`
	CommandName string `json:"commandName"`
	Payload     string `json:"payload"`
}

// InventorySyncResponse is returned after a successful inventory upload.
type InventorySyncResponse struct {
	Commands []PendingDeviceCommand `json:"commands,omitempty"`
}

// SubmitCommandResultRequest is posted by the agent after executing a command.
type SubmitCommandResultRequest struct {
	Status string `json:"status" binding:"required"`
	Output string `json:"output"`
}

// DeviceCommandLogJSON is one command log entry for the admin UI.
type DeviceCommandLogJSON struct {
	ID          uint       `json:"id"`
	CommandName string     `json:"commandName"`
	Payload     string     `json:"payload"`
	Status      string     `json:"status"`
	Output      string     `json:"output,omitempty"`
	CreatedAt   time.Time  `json:"createdAt"`
	ExecutedAt  *time.Time `json:"executedAt,omitempty"`
}

// DeviceCommandLogListResponse is returned by GET /devices/:hardwareId/logs.
type DeviceCommandLogListResponse struct {
	Items           []DeviceCommandLogJSON `json:"items"`
	TotalItemsCount int64                  `json:"totalItemsCount"`
}
