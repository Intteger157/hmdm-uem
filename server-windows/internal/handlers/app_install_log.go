package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

// ReportAppInstallLog upserts one Action Log row per app deployment attempt.
func (h *WindowsHandler) ReportAppInstallLog(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	deviceID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
		return
	}
	if hardwareID != deviceID {
		c.JSON(http.StatusForbidden, gin.H{"error": "hardware id mismatch"})
		return
	}

	var req models.ReportAppInstallLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := normalizeAppInstallLogStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	payloadBytes, err := json.Marshal(map[string]any{
		"appId":   req.AppID,
		"appName": strings.TrimSpace(req.AppName),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode payload"})
		return
	}

	now := time.Now()
	output := strings.TrimSpace(req.Output)

	existing, err := findActiveAppInstallLog(deviceID, req.AppID)
	if err != nil {
		log.Printf("[app-install-log] lookup failed: hardware_id=%q app_id=%d err=%v", deviceID, req.AppID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup app install log"})
		return
	}

	if existing != nil {
		existing.Status = status
		existing.Output = output
		existing.ExecutedAt = &now
		if err := db.DB.Save(existing).Error; err != nil {
			log.Printf("[app-install-log] update failed: hardware_id=%q app_id=%d err=%v", deviceID, req.AppID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update app install log"})
			return
		}
		log.Printf("[app-install-log] updated id=%d hardware_id=%q app_id=%d status=%q", existing.ID, deviceID, req.AppID, status)
		c.Status(http.StatusOK)
		return
	}

	entry := models.DeviceCommandLog{
		DeviceID:    deviceID,
		CommandName: models.CommandNameAppInstall,
		Payload:     string(payloadBytes),
		Status:      status,
		Output:      output,
		ExecutedAt:  &now,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("[app-install-log] save failed: hardware_id=%q app_id=%d err=%v", deviceID, req.AppID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save app install log"})
		return
	}

	log.Printf("[app-install-log] created id=%d hardware_id=%q app_id=%d status=%q", entry.ID, deviceID, req.AppID, status)
	c.Status(http.StatusOK)
}

func findActiveAppInstallLog(deviceID string, appID uint) (*models.DeviceCommandLog, error) {
	var logs []models.DeviceCommandLog
	if err := db.DB.
		Where("device_id = ? AND command_name = ?", deviceID, models.CommandNameAppInstall).
		Order("created_at DESC").
		Limit(25).
		Find(&logs).Error; err != nil {
		return nil, err
	}

	for _, entry := range logs {
		payloadAppID, err := parseAppInstallPayloadAppID(entry.Payload)
		if err != nil || payloadAppID != appID {
			continue
		}
		if isActiveAppInstallStatus(entry.Status) {
			return &entry, nil
		}
	}

	return nil, nil
}

func parseAppInstallPayloadAppID(payload string) (uint, error) {
	var parsed struct {
		AppID uint `json:"appId"`
	}
	if err := json.Unmarshal([]byte(payload), &parsed); err != nil {
		return 0, err
	}
	return parsed.AppID, nil
}

func isActiveAppInstallStatus(status string) bool {
	switch strings.TrimSpace(status) {
	case models.AppInstallStatusDownloading,
		models.AppInstallStatusInstalling,
		models.CommandLogStatusPending,
		models.AppInstallStepAppCheck,
		models.AppInstallStepAppDownload,
		models.AppInstallStepAppUnblock,
		models.AppInstallStepAppInstall,
		models.AppInstallStepAppResult:
		return true
	default:
		return false
	}
}

func normalizeAppInstallLogStatus(raw string) string {
	switch strings.TrimSpace(raw) {
	case models.AppInstallStatusDownloading,
		models.AppInstallStatusInstalling,
		models.AppInstallStatusSuccess,
		models.AppInstallStatusFailed,
		models.AppInstallStepAppCheck,
		models.AppInstallStepAppDownload,
		models.AppInstallStepAppUnblock,
		models.AppInstallStepAppInstall,
		models.AppInstallStepAppResult:
		return strings.TrimSpace(raw)
	default:
		return ""
	}
}
