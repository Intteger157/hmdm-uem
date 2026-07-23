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

// ReportAppInstallLog stores app deployment progress in Action Logs.
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
	entry := models.DeviceCommandLog{
		DeviceID:    deviceID,
		CommandName: models.CommandNameAppInstall,
		Payload:     string(payloadBytes),
		Status:      status,
		Output:      strings.TrimSpace(req.Output),
		ExecutedAt:  &now,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("[app-install-log] save failed: hardware_id=%q app_id=%d err=%v", deviceID, req.AppID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save app install log"})
		return
	}

	c.Status(http.StatusOK)
}

func normalizeAppInstallLogStatus(raw string) string {
	switch strings.TrimSpace(raw) {
	case models.AppInstallStatusDownloading,
		models.AppInstallStatusInstalling,
		models.AppInstallStatusSuccess,
		models.AppInstallStatusFailed:
		return strings.TrimSpace(raw)
	default:
		return ""
	}
}
