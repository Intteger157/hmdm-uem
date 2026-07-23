package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

var kbPayloadPattern = regexp.MustCompile(`^KB[0-9]+$`)

// EnqueueDeviceCommand creates a pending DeviceCommandLog entry for a Windows device.
func (h *WindowsHandler) EnqueueDeviceCommand(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}

	var req models.EnqueueDeviceCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.enqueueDeviceCommandLog(c, hardwareID, strings.TrimSpace(req.CommandName), strings.TrimSpace(req.Payload))
}

func (h *WindowsHandler) enqueueDeviceCommandLog(c *gin.Context, hardwareID, commandName, payload string) {
	if commandName == "" || payload == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "commandName and payload are required"})
		return
	}

	switch commandName {
	case models.CommandNameUninstallUpdate:
		payload = strings.ToUpper(payload)
		if !kbPayloadPattern.MatchString(payload) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payload must be a KB number like KB5012345"})
			return
		}
	case models.CommandNamePowerShell:
		// payload is raw script text (non-empty check above)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported commandName"})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	entry := models.DeviceCommandLog{
		DeviceID:    hardwareID,
		CommandName: commandName,
		Payload:     payload,
		Status:      models.CommandLogStatusPending,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("[enqueue-device-command] create failed: hardware_id=%q command=%q err=%v", hardwareID, commandName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue command"})
		return
	}

	log.Printf("[enqueue-device-command] queued id=%d hardware_id=%q command=%q payload=%q", entry.ID, hardwareID, commandName, payload)
	c.JSON(http.StatusAccepted, models.EnqueueDeviceCommandResponse{
		ID:          entry.ID,
		CommandName: entry.CommandName,
		Payload:     entry.Payload,
		Status:      entry.Status,
	})
}

// ListDeviceCommandLogs returns command execution history for a Windows device.
func (h *WindowsHandler) ListDeviceCommandLogs(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}

	var entries []models.DeviceCommandLog
	var total int64

	query := db.DB.Model(&models.DeviceCommandLog{}).Where("device_id = ?", hardwareID)
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count command logs"})
		return
	}

	if err := query.Order("id DESC").Limit(200).Find(&entries).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list command logs"})
		return
	}

	items := make([]models.DeviceCommandLogJSON, 0, len(entries))
	for _, entry := range entries {
		items = append(items, toDeviceCommandLogJSON(entry))
	}

	c.JSON(http.StatusOK, models.DeviceCommandLogListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// SubmitCommandResult records agent execution output for a DeviceCommandLog entry.
func (h *WindowsHandler) SubmitCommandResult(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	deviceID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	commandID, ok := parseUintParam(c.Param("commandId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid command id"})
		return
	}

	var req models.SubmitCommandResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := strings.TrimSpace(req.Status)
	switch status {
	case models.CommandLogStatusSuccess, models.CommandLogStatusFailed:
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "status must be Success or Failed"})
		return
	}

	var entry models.DeviceCommandLog
	if err := db.DB.Where("id = ? AND device_id = ?", commandID, deviceID).First(&entry).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "command not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup command"})
		return
	}

	if entry.Status != models.CommandLogStatusPending {
		c.JSON(http.StatusConflict, gin.H{"error": "command already completed"})
		return
	}

	now := time.Now()
	entry.Status = status
	entry.Output = strings.TrimSpace(req.Output)
	entry.ExecutedAt = &now

	if err := db.DB.Save(&entry).Error; err != nil {
		log.Printf("[submit-command-result] save failed: id=%d err=%v", commandID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save command result"})
		return
	}

	log.Printf("[submit-command-result] id=%d hardware_id=%q command=%q status=%q", commandID, deviceID, entry.CommandName, status)
	c.Status(http.StatusOK)
}

func pendingDeviceCommands(deviceID string) []models.PendingDeviceCommand {
	var entries []models.DeviceCommandLog
	if err := db.DB.Where("device_id = ? AND status = ?", deviceID, models.CommandLogStatusPending).
		Order("id ASC").
		Limit(10).
		Find(&entries).Error; err != nil {
		log.Printf("[inventory] pending commands lookup failed: device_id=%q err=%v", deviceID, err)
		return nil
	}

	pending := make([]models.PendingDeviceCommand, 0, len(entries))
	for _, entry := range entries {
		pending = append(pending, models.PendingDeviceCommand{
			ID:          entry.ID,
			CommandName: entry.CommandName,
			Payload:     entry.Payload,
		})
	}
	return pending
}

func payloadString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return strings.TrimSpace(asString)
	}
	if kb, ok := parseUninstallUpdatePayload(raw); ok {
		return kb
	}
	return strings.TrimSpace(string(raw))
}

func toDeviceCommandLogJSON(entry models.DeviceCommandLog) models.DeviceCommandLogJSON {
	return models.DeviceCommandLogJSON{
		ID:          entry.ID,
		CommandName: entry.CommandName,
		Payload:     entry.Payload,
		Status:      entry.Status,
		Output:      entry.Output,
		CreatedAt:   entry.CreatedAt,
		ExecutedAt:  entry.ExecutedAt,
	}
}

func parsePowerShellPayload(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}

	var asObject struct {
		Script string `json:"script"`
	}
	if err := json.Unmarshal(raw, &asObject); err == nil {
		if script := strings.TrimSpace(asObject.Script); script != "" {
			return script
		}
	}

	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return strings.TrimSpace(asString)
	}

	return strings.TrimSpace(string(raw))
}

func parseUninstallUpdatePayload(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}

	var asObject struct {
		KB string `json:"kb"`
	}
	if err := json.Unmarshal(raw, &asObject); err == nil {
		kb := strings.ToUpper(strings.TrimSpace(asObject.KB))
		if kbPayloadPattern.MatchString(kb) {
			return kb, true
		}
	}

	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		kb := strings.ToUpper(strings.TrimSpace(asString))
		if kbPayloadPattern.MatchString(kb) {
			return kb, true
		}
	}

	return "", false
}
