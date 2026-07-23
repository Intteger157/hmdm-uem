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

// EffectiveConfigResponse is the merged policy payload for one device.
type EffectiveConfigResponse struct {
	Payload          WindowsConfigProfilePayload `json:"payload"`
	ProfileID        uint                        `json:"profileId,omitempty"`
	ProfileName      string                      `json:"profileName,omitempty"`
	Source           string                      `json:"source,omitempty"`
	AppliedProfiles  []AppliedProfileSource      `json:"appliedProfiles"`
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
