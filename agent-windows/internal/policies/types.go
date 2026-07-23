//go:build windows

package policies

// Payload mirrors the effective configuration payload from server-windows.
type Payload struct {
	DefenderEnabled   bool `json:"defenderEnabled"`
	BlockUsbStorage   bool `json:"blockUsbStorage"`
	UsbReadOnly       bool `json:"usbReadOnly"`
	ScreenLockTimeout int  `json:"screenLockTimeout"`
}

// EffectiveConfig is the full effective-config API response cached locally.
type EffectiveConfig struct {
	Payload     Payload `json:"payload"`
	ProfileID   uint    `json:"profileId,omitempty"`
	ProfileName string  `json:"profileName,omitempty"`
	Source      string  `json:"source,omitempty"`
	UpdatedAt   string  `json:"updatedAt,omitempty"`
}

// AppliedPolicy tracks the last successfully enforced payload.
type AppliedPolicy struct {
	Payload    Payload `json:"payload"`
	EnforcedAt string  `json:"enforcedAt,omitempty"`
}

// Result captures one policy enforcement or compliance check outcome.
type Result struct {
	Name    string
	Success bool
	Message string
}

func EqualPayload(a, b Payload) bool {
	return a.DefenderEnabled == b.DefenderEnabled &&
		a.BlockUsbStorage == b.BlockUsbStorage &&
		a.UsbReadOnly == b.UsbReadOnly &&
		a.ScreenLockTimeout == b.ScreenLockTimeout
}
