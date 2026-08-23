package handlers

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/hmdm/server-windows/internal/auth"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// issueAgentToken generates a per-device token, persists its hash, and returns the raw secret.
func issueAgentToken(device *models.WindowsDevice) (string, error) {
	if device == nil {
		return "", fmt.Errorf("device is nil")
	}
	if db.DB == nil {
		return "", fmt.Errorf("database is not configured")
	}

	raw, hash, err := auth.GenerateAgentToken()
	if err != nil {
		return "", err
	}

	result := db.DB.Model(&models.WindowsDevice{}).
		Where("id = ?", device.ID).
		Update("agent_token_hash", hash)
	if result.Error != nil {
		return "", fmt.Errorf("persist agent token hash: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return "", fmt.Errorf("device not found for token issue")
	}

	device.AgentTokenHash = hash
	log.Printf("[agent-token] issued secure token for hardware_id=%q", device.HardwareID)
	return raw, nil
}

// authenticateAgentToken validates a migration refresh request and returns the device when allowed.
func authenticateAgentToken(hardwareID, rawToken string) (models.WindowsDevice, error) {
	hardwareID = strings.TrimSpace(hardwareID)
	rawToken = strings.TrimSpace(rawToken)
	if hardwareID == "" {
		return models.WindowsDevice{}, errMissingHardwareID
	}
	if rawToken == "" {
		return models.WindowsDevice{}, errMissingAgentToken
	}
	if db.DB == nil {
		return models.WindowsDevice{}, errDatabaseUnavailable
	}

	var device models.WindowsDevice
	err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.WindowsDevice{}, errDeviceNotFound
	}
	if err != nil {
		return models.WindowsDevice{}, fmt.Errorf("lookup device: %w", err)
	}

	if strings.TrimSpace(device.AgentTokenHash) != "" {
		if auth.HashAgentToken(rawToken) == device.AgentTokenHash {
			return device, nil
		}
		if auth.IsLegacyAgentToken(rawToken) {
			return models.WindowsDevice{}, errLegacyTokenRetired
		}
		return models.WindowsDevice{}, errInvalidAgentToken
	}

	if auth.IsLegacyAgentToken(rawToken) {
		if !auth.AllowLegacyAgentTokens() {
			return models.WindowsDevice{}, errLegacyTokenDisabled
		}
		log.Printf("[agent-token] migration refresh using legacy token: hardware_id=%q", hardwareID)
		return device, nil
	}

	return models.WindowsDevice{}, errInvalidAgentToken
}

var (
	errMissingHardwareID     = errors.New("missing hardware id")
	errMissingAgentToken     = errors.New("missing agent token")
	errDatabaseUnavailable   = errors.New("database unavailable")
	errDeviceNotFound        = errors.New("device not found")
	errInvalidAgentToken     = errors.New("invalid agent token")
	errLegacyTokenRetired    = errors.New("legacy token retired for device")
	errLegacyTokenDisabled   = errors.New("legacy agent tokens disabled")
)
