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
	RequireBitLocker  bool `json:"requireBitLocker"`
}

// WindowsConfigProfile is a reusable Windows device policy profile.
type WindowsConfigProfile struct {
	ID          uint            `gorm:"primaryKey"`
	Name        string          `gorm:"not null"`
	Description string
	Payload     json.RawMessage `gorm:"type:jsonb"`
	IsActive    bool            `gorm:"default:false"`
	IsDefault   bool            `gorm:"column:is_default;default:false"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (WindowsConfigProfile) TableName() string {
	return "windows_config_profiles"
}

// UpsertConfigProfileRequest is sent by the admin UI to create or update a profile.
type UpsertConfigProfileRequest struct {
	Name         string                      `json:"name" binding:"required"`
	Description  string                      `json:"description"`
	Payload      WindowsConfigProfilePayload `json:"payload" binding:"required"`
	IsActive     bool                        `json:"isActive"`
	IsDefault    bool                        `json:"isDefault"`
	RequiredApps []RequiredAppRequest        `json:"requiredApps"`
	AppIDs       []uint                      `json:"appIds"`
	Assignments  []ProfileAppAssignment      `json:"assignments"`
}

// RequiredAppsProvided reports whether the client sent required app selections.
func (req UpsertConfigProfileRequest) RequiredAppsProvided() bool {
	return req.RequiredApps != nil || req.AppIDs != nil || req.Assignments != nil
}

// NormalizedAssignments resolves required apps from requiredApps and legacy fields.
func (req UpsertConfigProfileRequest) NormalizedAssignments() ([]ProfileAppAssignment, error) {
	if len(req.RequiredApps) > 0 {
		return NormalizeRequiredAppRequests(req.RequiredApps)
	}

	if req.Assignments != nil || req.AppIDs != nil {
		return normalizeLegacyProfileAssignments(req.AppIDs, req.Assignments), nil
	}

	return nil, nil
}

func normalizeLegacyProfileAssignments(appIDs []uint, assignments []ProfileAppAssignment) []ProfileAppAssignment {
	if len(assignments) > 0 {
		return dedupeProfileAssignments(assignments)
	}

	result := make([]ProfileAppAssignment, 0, len(appIDs))
	for _, appID := range uniqueUintIDs(appIDs) {
		if appID == 0 {
			continue
		}
		result = append(result, ProfileAppAssignment{AppID: appID})
	}
	return result
}

func uniqueUintIDs(values []uint) []uint {
	seen := make(map[uint]struct{}, len(values))
	result := make([]uint, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

// UnmarshalJSON accepts requiredApps and legacy required_apps payloads.
func (req *UpsertConfigProfileRequest) UnmarshalJSON(data []byte) error {
	type alias UpsertConfigProfileRequest
	aux := struct {
		RequiredAppsSnake []RequiredAppRequest `json:"required_apps"`
		*alias
	}{
		alias: (*alias)(req),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	if len(aux.RequiredAppsSnake) > 0 && len(req.RequiredApps) == 0 {
		req.RequiredApps = aux.RequiredAppsSnake
	}
	return nil
}

// ConfigProfileJSON is one configuration profile for the admin UI.
type ConfigProfileJSON struct {
	ID          uint                        `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Payload     WindowsConfigProfilePayload `json:"payload"`
	IsActive    bool                        `json:"isActive"`
	IsDefault   bool                        `json:"isDefault"`
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
		IsDefault:   profile.IsDefault,
		CreatedAt:   profile.CreatedAt,
		UpdatedAt:   profile.UpdatedAt,
	}, nil
}
