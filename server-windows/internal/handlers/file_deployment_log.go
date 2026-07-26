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

// ReportFileDeploymentLog stores file deployment progress in Action Logs.
func (h *WindowsHandler) ReportFileDeploymentLog(c *gin.Context) {
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

	var req models.ReportFileDeploymentLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := normalizeFileDeploymentLogStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		return
	}

	payloadBytes, err := json.Marshal(map[string]any{
		"deploymentId": req.DeploymentID,
		"fileId":       req.FileID,
		"fileName":     strings.TrimSpace(req.FileName),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode payload"})
		return
	}

	now := time.Now()
	output := strings.TrimSpace(req.Output)

	existing, createNew, err := resolveFileDeploymentLogTarget(deviceID, req.DeploymentID, status)
	if err != nil {
		log.Printf("[file-deployment-log] lookup failed: hardware_id=%q deployment_id=%d err=%v", deviceID, req.DeploymentID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup file deployment log"})
		return
	}

	if existing != nil && !createNew {
		existing.Status = status
		existing.Output = output
		existing.ExecutedAt = &now
		if err := db.DB.Save(existing).Error; err != nil {
			log.Printf("[file-deployment-log] update failed: hardware_id=%q deployment_id=%d err=%v", deviceID, req.DeploymentID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update file deployment log"})
			return
		}
		log.Printf("[file-deployment-log] updated id=%d hardware_id=%q deployment_id=%d status=%q", existing.ID, deviceID, req.DeploymentID, status)
		c.Status(http.StatusOK)
		return
	}

	entry := models.DeviceCommandLog{
		DeviceID:    deviceID,
		CommandName: models.CommandNameFileDeployment,
		Payload:     string(payloadBytes),
		Status:      status,
		Output:      output,
		ExecutedAt:  &now,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("[file-deployment-log] save failed: hardware_id=%q deployment_id=%d err=%v", deviceID, req.DeploymentID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file deployment log"})
		return
	}

	log.Printf("[file-deployment-log] created id=%d hardware_id=%q deployment_id=%d status=%q", entry.ID, deviceID, req.DeploymentID, status)
	c.Status(http.StatusOK)
}

func normalizeFileDeploymentLogStatus(status string) string {
	switch strings.TrimSpace(status) {
	case models.CommandLogStatusPending:
		return models.CommandLogStatusPending
	case models.CommandLogStatusSuccess:
		return models.CommandLogStatusSuccess
	case models.CommandLogStatusFailed:
		return models.CommandLogStatusFailed
	case models.CommandLogStatusCanceled:
		return models.CommandLogStatusCanceled
	case models.AppInstallStatusDownloading:
		return models.AppInstallStatusDownloading
	case models.AppInstallStatusInstalling:
		return models.AppInstallStatusInstalling
	default:
		return ""
	}
}

func resolveFileDeploymentLogTarget(deviceID string, deploymentID uint, status string) (*models.DeviceCommandLog, bool, error) {
	existing, err := findLatestFileDeploymentLog(deviceID, deploymentID)
	if err != nil {
		return nil, false, err
	}
	if existing == nil {
		return nil, true, nil
	}
	if isTerminalFileDeploymentLogStatus(existing.Status) && isTerminalFileDeploymentLogStatus(status) {
		return nil, true, nil
	}
	return existing, false, nil
}

func findLatestFileDeploymentLog(deviceID string, deploymentID uint) (*models.DeviceCommandLog, error) {
	var logs []models.DeviceCommandLog
	if err := db.DB.
		Where("device_id = ? AND command_name = ?", deviceID, models.CommandNameFileDeployment).
		Order("id DESC").
		Limit(20).
		Find(&logs).Error; err != nil {
		return nil, err
	}

	needle := deploymentID
	for _, entry := range logs {
		var payload map[string]any
		if err := json.Unmarshal([]byte(entry.Payload), &payload); err != nil {
			continue
		}
		value, ok := payload["deploymentId"].(float64)
		if !ok || uint(value) != needle {
			continue
		}
		copy := entry
		return &copy, nil
	}
	return nil, nil
}

func isTerminalFileDeploymentLogStatus(status string) bool {
	switch status {
	case models.CommandLogStatusSuccess, models.CommandLogStatusFailed, models.CommandLogStatusCanceled:
		return true
	default:
		return false
	}
}
