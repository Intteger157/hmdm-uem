package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

type submitBitLockerKeyRequest struct {
	RecoveryKey  string `json:"recoveryKey"`
	BitLockerKey string `json:"bitlocker_key"`
}

func (req submitBitLockerKeyRequest) normalizedKey() string {
	if key := strings.TrimSpace(req.RecoveryKey); key != "" {
		return key
	}
	return strings.TrimSpace(req.BitLockerKey)
}

// SubmitBitLockerKey stores a BitLocker recovery password reported by the agent.
func (h *WindowsHandler) SubmitBitLockerKey(c *gin.Context) {
	deviceID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}
	if hardwareID != deviceID {
		c.JSON(http.StatusForbidden, gin.H{"error": "hardware id mismatch"})
		return
	}

	var req submitBitLockerKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	recoveryKey := req.normalizedKey()
	if recoveryKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recovery key is required"})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		log.Printf("[bitlocker-key] lookup failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	device.BitLockerKey = recoveryKey
	device.DiskEncrypted = true
	if strings.TrimSpace(device.EncryptionStatus) == "" {
		device.EncryptionStatus = "on"
	}

	if err := db.DB.Save(&device).Error; err != nil {
		log.Printf("[bitlocker-key] save failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save recovery key"})
		return
	}

	log.Printf("[bitlocker-key] stored recovery key for hardware_id=%q", hardwareID)
	c.Status(http.StatusOK)
}
