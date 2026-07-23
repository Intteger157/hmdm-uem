//go:build windows

package policies

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/hmdm/agent-windows/internal/apps"
)

const emptyPolicyHash = "no-policy"

type configFingerprint struct {
	Payload      Payload            `json:"payload"`
	RequiredApps []apps.RequiredApp `json:"requiredApps"`
	ProfileID    uint               `json:"profileId"`
	ProfileName  string             `json:"profileName"`
	Source       string             `json:"source"`
}

// HasAssignedPolicy reports whether the server assigned an active configuration profile.
func (c EffectiveConfig) HasAssignedPolicy() bool {
	if c.ProfileID > 0 {
		return true
	}
	if strings.TrimSpace(c.ProfileName) != "" {
		return true
	}
	if strings.TrimSpace(c.Source) != "" {
		return true
	}
	return len(c.RequiredApps) > 0
}

// ConfigHash returns a stable fingerprint for diffing server-provided configuration.
func ConfigHash(config EffectiveConfig) string {
	if !config.HasAssignedPolicy() {
		return emptyPolicyHash
	}

	payload, err := json.Marshal(configFingerprint{
		Payload:      config.Payload,
		RequiredApps: config.RequiredApps,
		ProfileID:    config.ProfileID,
		ProfileName:  config.ProfileName,
		Source:       config.Source,
	})
	if err != nil {
		return ""
	}

	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func IsEmptyPolicyHash(hash string) bool {
	return hash == emptyPolicyHash
}
