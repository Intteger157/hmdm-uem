package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

// ReportPolicyEnforcement stores agent policy enforcement output in Action Logs.
func (h *WindowsHandler) ReportPolicyEnforcement(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

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

	var req models.ReportPolicyEnforcementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := models.CommandLogStatusFailed
	if req.Success {
		status = models.CommandLogStatusSuccess
	}

	now := time.Now()
	entry := models.DeviceCommandLog{
		DeviceID:    deviceID,
		CommandName: models.CommandNamePolicyEnforcement,
		Payload:     "enforce",
		Status:      status,
		Output:      strings.TrimSpace(req.Output),
		ExecutedAt:  &now,
	}

	if err := db.DB.Create(&entry).Error; err != nil {
		log.Printf("[policy-enforcement] save failed: hardware_id=%q err=%v", deviceID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save policy enforcement log"})
		return
	}

	log.Printf("[policy-enforcement] logged id=%d hardware_id=%q success=%v", entry.ID, deviceID, req.Success)
	c.Status(http.StatusOK)
}
