package models

const (
	AssignmentSourceGroup  = "group"
	AssignmentSourceDirect = "direct"
)

// AppliedProfileSource describes one profile that contributed to effective policy.
type AppliedProfileSource struct {
	ProfileID   uint   `json:"profileId"`
	ProfileName string `json:"profileName"`
	Source      string `json:"source"`
}

// RequiredApp is one app the agent must install for a device.
type RequiredApp struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	DownloadURL     string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
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
