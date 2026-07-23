package models

import (
	"encoding/json"
	"fmt"
	"time"
)

// WindowsConfigProfilePayload holds MVP security policy settings stored in JSONB.
type WindowsConfigProfilePayload struct {
	DefenderEnabled   bool `json:"defenderEnabled"`
	BlockUsbStorage   bool `json:"blockUsbStorage"`
	UsbReadOnly       bool `json:"usbReadOnly"`
	ScreenLockTimeout int  `json:"screenLockTimeout"`
}

// WindowsConfigProfile is a reusable Windows device policy profile.
type WindowsConfigProfile struct {
	ID          uint            `gorm:"primaryKey"`
	Name        string          `gorm:"not null"`
	Description string
	Payload     json.RawMessage `gorm:"type:jsonb"`
	IsActive    bool            `gorm:"default:false"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (WindowsConfigProfile) TableName() string {
	return "windows_config_profiles"
}

// UpsertConfigProfileRequest is sent by the admin UI to create or update a profile.
type UpsertConfigProfileRequest struct {
	Name        string                      `json:"name" binding:"required"`
	Description string                      `json:"description"`
	Payload     WindowsConfigProfilePayload `json:"payload" binding:"required"`
	IsActive    bool                        `json:"isActive"`
}

// ConfigProfileJSON is one configuration profile for the admin UI.
type ConfigProfileJSON struct {
	ID          uint                        `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Payload     WindowsConfigProfilePayload `json:"payload"`
	IsActive    bool                        `json:"isActive"`
	CreatedAt   time.Time                   `json:"createdAt"`
	UpdatedAt   time.Time                   `json:"updatedAt"`
}

// ConfigProfileListResponse is returned by GET /configurations.
type ConfigProfileListResponse struct {
	Items           []ConfigProfileJSON `json:"items"`
	TotalItemsCount int64               `json:"totalItemsCount"`
}

func EncodeConfigProfilePayload(payload WindowsConfigProfilePayload) (json.RawMessage, error) {
	if payload.ScreenLockTimeout < 0 {
		return nil, fmt.Errorf("screenLockTimeout must be >= 0")
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}
	return encoded, nil
}

func DecodeConfigProfilePayload(raw json.RawMessage) (WindowsConfigProfilePayload, error) {
	if len(raw) == 0 {
		return WindowsConfigProfilePayload{}, nil
	}
	var payload WindowsConfigProfilePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return WindowsConfigProfilePayload{}, fmt.Errorf("unmarshal payload: %w", err)
	}
	return payload, nil
}

func ToConfigProfileJSON(profile WindowsConfigProfile) (ConfigProfileJSON, error) {
	payload, err := DecodeConfigProfilePayload(profile.Payload)
	if err != nil {
		return ConfigProfileJSON{}, err
	}
	return ConfigProfileJSON{
		ID:          profile.ID,
		Name:        profile.Name,
		Description: profile.Description,
		Payload:     payload,
		IsActive:    profile.IsActive,
		CreatedAt:   profile.CreatedAt,
		UpdatedAt:   profile.UpdatedAt,
	}, nil
}
