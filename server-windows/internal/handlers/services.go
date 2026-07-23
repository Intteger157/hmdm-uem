package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// GetDeviceServices returns the cached Windows services list for a device.
func (h *WindowsHandler) GetDeviceServices(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
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

	c.JSON(http.StatusOK, models.DeviceServicesResponse{
		Items:     models.DecodeServices(device.Services),
		UpdatedAt: device.ServicesUpdatedAt,
	})
}

// RefreshDeviceServices enqueues a get_services command for the agent.
func (h *WindowsHandler) RefreshDeviceServices(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
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
		Action:     "get_services",
		Status:     models.CommandStatusPending,
	}
	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[refresh-services] create failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue command"})
		return
	}

	c.JSON(http.StatusAccepted, models.EnqueueCommandResponse{
		ID:     command.ID,
		Action: command.Action,
		Status: command.Status,
	})
}

// RestartDeviceService enqueues a restart_service command for one Windows service.
func (h *WindowsHandler) RestartDeviceService(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	serviceName := strings.TrimSpace(c.Param("serviceName"))
	if hardwareID == "" || serviceName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id or service name"})
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

	payload, err := json.Marshal(map[string]string{"service_name": serviceName})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encode payload"})
		return
	}

	command := models.WindowsDeviceCommand{
		HardwareID: hardwareID,
		Action:     "restart_service",
		Payload:    payload,
		Status:     models.CommandStatusPending,
	}
	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[restart-service] create failed: hardware_id=%q service=%q err=%v", hardwareID, serviceName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue command"})
		return
	}

	c.JSON(http.StatusAccepted, models.EnqueueCommandResponse{
		ID:     command.ID,
		Action: command.Action,
		Status: command.Status,
	})
}

// persistServicesFromCommandResult stores agent get_services output on the device record.
func persistServicesFromCommandResult(hardwareID, result string, success bool) {
	if !success || strings.TrimSpace(result) == "" {
		return
	}

	var agentServices []models.InventoryService
	if err := json.Unmarshal([]byte(result), &agentServices); err != nil {
		log.Printf("[complete-command] parse services failed: hardware_id=%q err=%v", hardwareID, err)
		return
	}

	encoded, err := models.EncodeServicesFromAgent(agentServices)
	if err != nil {
		log.Printf("[complete-command] encode services failed: hardware_id=%q err=%v", hardwareID, err)
		return
	}

	now := time.Now()
	if err := db.DB.Model(&models.WindowsDevice{}).
		Where("hardware_id = ?", hardwareID).
		Updates(map[string]interface{}{
			"services":            encoded,
			"services_updated_at": now,
		}).Error; err != nil {
		log.Printf("[complete-command] save services failed: hardware_id=%q err=%v", hardwareID, err)
	}
}
