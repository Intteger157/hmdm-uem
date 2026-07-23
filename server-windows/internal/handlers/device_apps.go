package handlers

import (
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

// AssignDeviceApp assigns one catalog app directly to a device.
func (h *WindowsHandler) AssignDeviceApp(c *gin.Context) {
	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
		return
	}

	appID, ok := parseUintParam(c.Param("appId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
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

	if err := db.DB.First(&models.SoftwareApp{}, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "software app not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup software app"})
		return
	}

	link := models.WindowsDeviceApp{DeviceID: device.ID, AppID: appID}
	result := db.DB.FirstOrCreate(&link, models.WindowsDeviceApp{DeviceID: device.ID, AppID: appID})
	if result.Error != nil {
		log.Printf("[assign-device-app] save failed: device_id=%d app_id=%d err=%v", device.ID, appID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign app to device"})
		return
	}

	if err := upsertDeviceAppStatusPending(device.ID, appID); err != nil {
		log.Printf("[assign-device-app] status init failed: device_id=%d app_id=%d err=%v", device.ID, appID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to initialize app deployment status"})
		return
	}

	statusCode := http.StatusOK
	if result.RowsAffected > 0 {
		statusCode = http.StatusCreated
	}

	log.Printf("[assign-device-app] device_id=%d app_id=%d hardware_id=%q", device.ID, appID, hardwareID)
	c.Status(statusCode)
}

// UnassignDeviceApp removes a direct app assignment from a device.
func (h *WindowsHandler) UnassignDeviceApp(c *gin.Context) {
	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
		return
	}

	appID, ok := parseUintParam(c.Param("appId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
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

	result := db.DB.Where("device_id = ? AND app_id = ?", device.ID, appID).Delete(&models.WindowsDeviceApp{})
	if result.Error != nil {
		log.Printf("[unassign-device-app] delete failed: device_id=%d app_id=%d err=%v", device.ID, appID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unassign app from device"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "direct app assignment not found"})
		return
	}

	if err := db.DB.Where("device_id = ? AND app_id = ?", device.ID, appID).Delete(&models.DeviceAppStatus{}).Error; err != nil {
		log.Printf("[unassign-device-app] status cleanup failed: device_id=%d app_id=%d err=%v", device.ID, appID, err)
	}

	log.Printf("[unassign-device-app] device_id=%d app_id=%d hardware_id=%q", device.ID, appID, hardwareID)
	c.Status(http.StatusNoContent)
}

func upsertDeviceAppStatusPending(deviceID, appID uint) error {
	return upsertDeviceAppStatus(deviceID, appID, models.AppStatusPending, "")
}

func upsertDeviceAppStatus(deviceID, appID uint, status, errorMessage string) error {
	now := time.Now()
	record := models.DeviceAppStatus{
		DeviceID:     deviceID,
		AppID:        appID,
		Status:       status,
		ErrorMessage: strings.TrimSpace(errorMessage),
		UpdatedAt:    now,
	}

	var existing models.DeviceAppStatus
	err := db.DB.Where("device_id = ? AND app_id = ?", deviceID, appID).First(&existing).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		return db.DB.Create(&record).Error
	case err != nil:
		return err
	default:
		existing.Status = status
		existing.ErrorMessage = record.ErrorMessage
		existing.UpdatedAt = now
		return db.DB.Save(&existing).Error
	}
}

func syncDirectAppStatusFromInstallLog(hardwareID string, appID uint, installStatus, output string) {
	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error; err != nil {
		log.Printf("[app-install-log] direct status sync skipped: device lookup failed hardware_id=%q err=%v", hardwareID, err)
		return
	}

	var link models.WindowsDeviceApp
	if err := db.DB.Where("device_id = ? AND app_id = ?", device.ID, appID).First(&link).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return
		}
		log.Printf("[app-install-log] direct status sync skipped: assignment lookup failed device_id=%d app_id=%d err=%v", device.ID, appID, err)
		return
	}

	appStatus := models.AppStatusSuccess
	errorMessage := ""
	if installStatus == models.AppInstallStatusFailed {
		appStatus = models.AppStatusFailed
		errorMessage = output
	}

	if err := upsertDeviceAppStatus(device.ID, appID, appStatus, errorMessage); err != nil {
		log.Printf("[app-install-log] direct status sync failed: device_id=%d app_id=%d status=%q err=%v", device.ID, appID, appStatus, err)
		return
	}

	log.Printf("[app-install-log] synced direct app status device_id=%d app_id=%d status=%q", device.ID, appID, appStatus)
}

func deleteDirectDeviceApps(deviceID uint) error {
	return db.DB.Where("device_id = ?", deviceID).Delete(&models.WindowsDeviceApp{}).Error
}
