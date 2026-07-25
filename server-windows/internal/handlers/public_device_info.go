package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	appstorage "github.com/hmdm/server-windows/internal/storage"
	"gorm.io/gorm"
)

// GetPublicDeviceInfo returns safe read-only device metadata for the public info page.
func (h *WindowsHandler) GetPublicDeviceInfo(c *gin.Context) {
	deviceID := strings.TrimSpace(c.Param("deviceId"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing device id"})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", deviceID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	c.JSON(http.StatusOK, models.PublicDeviceInfoResponse{
		DeviceID:     device.HardwareID,
		Hostname:     strings.TrimSpace(device.Hostname),
		MDMServer:    buildPublicBaseURL(c),
		AgentVersion: resolvePublicAgentVersion(device),
		LastSyncTime: formatPublicLastSync(device.LastCheckin),
	})
}

func resolvePublicAgentVersion(device models.WindowsDevice) string {
	item := models.ToWindowsDeviceJSON(device)
	for _, app := range item.InstalledSoftware {
		name := strings.ToLower(strings.TrimSpace(app.Name))
		if strings.Contains(name, "singularity") && strings.Contains(name, "mdm") && strings.Contains(name, "agent") {
			if version := strings.TrimSpace(app.Version); version != "" {
				return version
			}
		}
	}

	if meta, ok := appstorage.LoadAgentBinaryMeta(); ok {
		if version := strings.TrimSpace(meta.Version); version != "" {
			return version
		}
	}

	return ""
}

func formatPublicLastSync(at time.Time) string {
	if at.IsZero() {
		return ""
	}
	return at.UTC().Format(time.RFC3339)
}

func buildPublicBaseURL(c *gin.Context) string {
	return buildPublicURL(c, "")
}
