package models

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"
)

const (
	AssignmentSourceGroup  = "group"
	AssignmentSourceDirect = "direct"
)

// AppliedProfileSource describes one profile that contributed to effective policy.
type AppliedProfileSource struct {
	ProfileID   uint      `json:"profileId"`
	ProfileName string    `json:"profileName"`
	Source      string    `json:"source"`
	UpdatedAt   time.Time `json:"updatedAt,omitempty"`
}

// RequiredApp is one app the agent must install for a device.
type RequiredApp struct {
	ID              uint      `json:"id"`
	VersionID       uint      `json:"versionId,omitempty"`
	Name            string    `json:"name"`
	Version         string    `json:"version"`
	UpdatedAt       time.Time `json:"updatedAt"`
	DownloadURL     string    `json:"downloadUrl"`
	InstallArgs     string    `json:"installArgs"`
	AppType         string    `json:"appType"`
	WingetID        string    `json:"wingetId"`
	AutoUpdate      bool      `json:"autoUpdate"`
	UpdateFrequency string    `json:"updateFrequency"`
}

// EffectiveConfigResponse is the merged policy payload for one device.
type EffectiveConfigResponse struct {
	Payload         WindowsConfigProfilePayload `json:"payload"`
	RequiredApps    []RequiredApp               `json:"requiredApps"`
	ProfileID       uint                        `json:"profileId,omitempty"`
	ProfileName     string                      `json:"profileName,omitempty"`
	Source          string                      `json:"source,omitempty"`
	AppliedProfiles []AppliedProfileSource      `json:"appliedProfiles"`
}

func OverlayConfigPayload(base, overlay WindowsConfigProfilePayload) WindowsConfigProfilePayload {
	return WindowsConfigProfilePayload{
		DefenderEnabled:   overlay.DefenderEnabled,
		BlockUsbStorage:   overlay.BlockUsbStorage,
		UsbReadOnly:       overlay.UsbReadOnly,
		ScreenLockTimeout: overlay.ScreenLockTimeout,
	}
}

func MergeConfigPayloads(groupPayloads, directPayloads []WindowsConfigProfilePayload) WindowsConfigProfilePayload {
	merged := WindowsConfigProfilePayload{}
	for _, payload := range groupPayloads {
		merged = OverlayConfigPayload(merged, payload)
	}
	for _, payload := range directPayloads {
		merged = OverlayConfigPayload(merged, payload)
	}
	return merged
}

const emptyEffectiveConfigHash = "no-policy"

type effectiveConfigFingerprint struct {
	Payload      WindowsConfigProfilePayload `json:"payload"`
	RequiredApps []requiredAppFingerprint    `json:"requiredApps"`
	ProfileID    uint                        `json:"profileId"`
	ProfileName  string                      `json:"profileName"`
	Source       string                      `json:"source"`
}

type requiredAppFingerprint struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	UpdatedAt       string `json:"updatedAt"`
	DownloadURL     string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
}

// HasAssignedEffectivePolicy reports whether the device has an active configuration assignment.
func HasAssignedEffectivePolicy(cfg EffectiveConfigResponse) bool {
	if cfg.ProfileID > 0 {
		return true
	}
	if strings.TrimSpace(cfg.ProfileName) != "" {
		return true
	}
	if strings.TrimSpace(cfg.Source) != "" {
		return true
	}
	return len(cfg.RequiredApps) > 0
}

// EffectiveConfigHash returns a stable fingerprint for agent check-in diffing.
func EffectiveConfigHash(cfg EffectiveConfigResponse) string {
	if !HasAssignedEffectivePolicy(cfg) {
		return emptyEffectiveConfigHash
	}

	requiredApps := make([]requiredAppFingerprint, 0, len(cfg.RequiredApps))
	for _, app := range cfg.RequiredApps {
		requiredApps = append(requiredApps, requiredAppFingerprint{
			ID:              app.ID,
			Name:            app.Name,
			Version:         app.Version,
			UpdatedAt:       formatJSONTime(app.UpdatedAt),
			DownloadURL:     app.DownloadURL,
			InstallArgs:     app.InstallArgs,
			AppType:         app.AppType,
			WingetID:        app.WingetID,
			AutoUpdate:      app.AutoUpdate,
			UpdateFrequency: app.UpdateFrequency,
		})
	}

	payload, err := json.Marshal(effectiveConfigFingerprint{
		Payload:      cfg.Payload,
		RequiredApps: requiredApps,
		ProfileID:    cfg.ProfileID,
		ProfileName:  cfg.ProfileName,
		Source:       cfg.Source,
	})
	if err != nil {
		return ""
	}

	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func formatJSONTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	encoded, err := json.Marshal(value.UTC())
	if err != nil {
		return value.UTC().Format(time.RFC3339Nano)
	}
	return strings.Trim(string(encoded), `"`)
}
