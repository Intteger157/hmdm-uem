package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var allowedCommandActions = map[string]struct{}{
	"sync":             {},
	"restart":          {},
	"lock":             {},
	"bitlocker_enable": {},
	"powershell":       {},
	"install":          {},
	"wipe":             {},
	"get_services":     {},
	"restart_service":  {},
}

// EnqueueCommand creates a pending remote command for a Windows device.
func (h *WindowsHandler) EnqueueCommand(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}

	var req models.EnqueueCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if commandName := strings.TrimSpace(req.CommandName); commandName != "" {
		h.enqueueDeviceCommandLog(c, hardwareID, commandName, payloadString(req.Payload))
		return
	}

	action := strings.TrimSpace(req.Action)
	if action == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "action or commandName is required"})
		return
	}
	if _, ok := allowedCommandActions[action]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported action"})
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

	command := models.WindowsDeviceCommand{
		HardwareID: hardwareID,
		Action:     action,
		Payload:    req.Payload,
		Status:     models.CommandStatusPending,
	}

	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[enqueue-command] create failed: hardware_id=%q action=%q err=%v", hardwareID, action, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue command"})
		return
	}

	log.Printf("[enqueue-command] queued id=%d hardware_id=%q action=%q", command.ID, hardwareID, action)
	c.JSON(http.StatusAccepted, models.EnqueueCommandResponse{
		ID:     command.ID,
		Action: command.Action,
		Status: command.Status,
	})
}

// GetLatestCommand returns the most recent command for a device (admin UI feedback).
func (h *WindowsHandler) GetLatestCommand(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}

	var command models.WindowsDeviceCommand
	if err := db.DB.Where("hardware_id = ?", hardwareID).Order("id DESC").First(&command).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "no commands"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup command"})
		return
	}

	c.JSON(http.StatusOK, models.LatestCommandResponse{
		ID:          command.ID,
		Action:      command.Action,
		Status:      command.Status,
		Result:      command.Result,
		CompletedAt: command.CompletedAt,
	})
}

// PollCommand returns the oldest pending command for the authenticated device.
func (h *WindowsHandler) PollCommand(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	deviceID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	resetStaleRunningCommands(deviceID)

	var command models.WindowsDeviceCommand
	err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("hardware_id = ? AND status = ?", deviceID, models.CommandStatusPending).
			Order("id ASC").
			First(&command).Error; err != nil {
			return err
		}

		command.Status = models.CommandStatusRunning
		return tx.Save(&command).Error
	})

	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.Status(http.StatusNoContent)
		return
	}
	if err != nil {
		log.Printf("[poll-command] failed: hardware_id=%q err=%v", deviceID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to poll command"})
		return
	}

	c.JSON(http.StatusOK, models.PollCommandResponse{
		ID:      command.ID,
		Action:  command.Action,
		Payload: command.Payload,
	})
}

// CompleteCommand records the agent execution result.
func (h *WindowsHandler) CompleteCommand(c *gin.Context) {
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

	var req models.CompleteCommandRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var command models.WindowsDeviceCommand
	if err := db.DB.Where("id = ? AND hardware_id = ?", commandID, deviceID).First(&command).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "command not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup command"})
		return
	}

	now := time.Now()
	command.CompletedAt = &now
	command.Result = strings.TrimSpace(req.Message)
	if req.Success {
		command.Status = models.CommandStatusCompleted
	} else {
		command.Status = models.CommandStatusFailed
	}

	if err := db.DB.Save(&command).Error; err != nil {
		log.Printf("[complete-command] save failed: id=%d err=%v", commandID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save command result"})
		return
	}

	if command.Action == "get_services" {
		persistServicesFromCommandResult(deviceID, command.Result, req.Success)
	}

	log.Printf("[complete-command] id=%d hardware_id=%q action=%q success=%v", commandID, deviceID, command.Action, req.Success)
	c.Status(http.StatusOK)
}

func validateAgentAuth(c *gin.Context) bool {
	authHeader := c.GetHeader("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return false
	}
	return true
}

func parseUintParam(raw string) (uint, bool) {
	value, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || value == 0 {
		return 0, false
	}
	return uint(value), true
}

func resetStaleRunningCommands(deviceID string) {
	staleBefore := time.Now().Add(-2 * time.Minute)
	result := db.DB.Model(&models.WindowsDeviceCommand{}).
		Where("hardware_id = ? AND status = ? AND updated_at < ?", deviceID, models.CommandStatusRunning, staleBefore).
		Update("status", models.CommandStatusPending)
	if result.Error != nil {
		log.Printf("[poll-command] reset stale running failed: hardware_id=%q err=%v", deviceID, result.Error)
		return
	}
	if result.RowsAffected > 0 {
		log.Printf("[poll-command] reset %d stale running command(s): hardware_id=%q", result.RowsAffected, deviceID)
	}
}
