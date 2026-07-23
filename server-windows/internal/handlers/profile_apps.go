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

// GetConfigProfileApps returns required apps for a profile.
func (h *WindowsHandler) GetConfigProfileApps(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	appIDs, err := listAssignedAppIDs(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load profile apps"})
		return
	}

	c.JSON(http.StatusOK, models.ProfileAppsResponse{AppIDs: appIDs})
}

// AssignConfigProfileApps replaces required apps for a profile.
func (h *WindowsHandler) AssignConfigProfileApps(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	var req models.AssignProfileAppsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	if err := validateAppIDs(req.AppIDs); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one or more apps were not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate apps"})
		return
	}

	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.ProfileApp{}).Error; err != nil {
			return err
		}
		for _, appID := range uniqueUints(req.AppIDs) {
			if err := tx.Create(&models.ProfileApp{ProfileID: profileID, AppID: appID}).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		log.Printf("[assign-profile-apps] save failed: profile_id=%d err=%v", profileID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save profile apps"})
		return
	}

	log.Printf("[assign-profile-apps] profile_id=%d apps=%d", profileID, len(req.AppIDs))
	c.JSON(http.StatusOK, models.ProfileAppsResponse{AppIDs: uniqueUints(req.AppIDs)})
}

func listAssignedAppIDs(profileID uint) ([]uint, error) {
	var rows []models.ProfileApp
	if err := db.DB.Where("profile_id = ?", profileID).Order("app_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.AppID)
	}
	return ids, nil
}

func validateAppIDs(appIDs []uint) error {
	unique := uniqueUints(appIDs)
	if len(unique) == 0 {
		return nil
	}

	var count int64
	if err := db.DB.Model(&models.SoftwareApp{}).Where("id IN ?", unique).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(unique) {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func deleteConfigProfileApps(profileID uint) error {
	return db.DB.Where("profile_id = ?", profileID).Delete(&models.ProfileApp{}).Error
}

// GetDeviceAppStatuses returns deployment statuses for a device.
func (h *WindowsHandler) GetDeviceAppStatuses(c *gin.Context) {
	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
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

	effective, err := buildEffectiveConfig(device)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build effective configuration"})
		return
	}

	items, err := buildDeviceAppStatusList(device.ID, effective.RequiredApps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load app statuses"})
		return
	}

	c.JSON(http.StatusOK, models.DeviceAppStatusListResponse{
		Items:         items,
		RequiredTotal: len(effective.RequiredApps),
	})
}

// ReportDeviceAppStatus stores agent deployment progress for one app.
func (h *WindowsHandler) ReportDeviceAppStatus(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	deviceID := stringsTrimDeviceHeader(c)
	if deviceID == "" {
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

	var req models.ReportDeviceAppStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status := normalizeAppStatus(req.Status)
	if status == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
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

	var app models.SoftwareApp
	if err := db.DB.First(&app, req.AppID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "software app not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup software app"})
		return
	}

	now := time.Now()
	record := models.DeviceAppStatus{
		DeviceID:     device.ID,
		AppID:        req.AppID,
		Status:       status,
		ErrorMessage: strings.TrimSpace(req.Error),
		UpdatedAt:    now,
	}

	var existing models.DeviceAppStatus
	err := db.DB.Where("device_id = ? AND app_id = ?", device.ID, req.AppID).First(&existing).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		if err := db.DB.Create(&record).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save app status"})
			return
		}
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup app status"})
		return
	default:
		existing.Status = status
		existing.ErrorMessage = record.ErrorMessage
		existing.UpdatedAt = now
		if err := db.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update app status"})
			return
		}
	}

	c.Status(http.StatusOK)
}

func buildDeviceAppStatusList(deviceID uint, required []models.RequiredApp) ([]models.DeviceAppStatusJSON, error) {
	if len(required) == 0 {
		return nil, nil
	}

	appIDs := make([]uint, 0, len(required))
	appByID := make(map[uint]models.RequiredApp, len(required))
	for _, app := range required {
		appIDs = append(appIDs, app.ID)
		appByID[app.ID] = app
	}

	var statuses []models.DeviceAppStatus
	if err := db.DB.Where("device_id = ? AND app_id IN ?", deviceID, appIDs).Find(&statuses).Error; err != nil {
		return nil, err
	}

	statusByAppID := make(map[uint]models.DeviceAppStatus, len(statuses))
	for _, status := range statuses {
		statusByAppID[status.AppID] = status
	}

	items := make([]models.DeviceAppStatusJSON, 0, len(required))
	for _, app := range required {
		item := models.DeviceAppStatusJSON{
			AppID:      app.ID,
			AppName:    app.Name,
			AppVersion: app.Version,
			Status:     models.AppStatusPending,
		}
		if status, ok := statusByAppID[app.ID]; ok {
			item.Status = status.Status
			item.ErrorMessage = status.ErrorMessage
			item.UpdatedAt = status.UpdatedAt
		}
		items = append(items, item)
	}
	return items, nil
}

func normalizeAppStatus(raw string) string {
	switch raw {
	case models.AppStatusPending,
		models.AppStatusDownloading,
		models.AppStatusInstalling,
		models.AppStatusSuccess,
		models.AppStatusFailed:
		return raw
	default:
		return ""
	}
}

func stringsTrimHardwareID(c *gin.Context) string {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return ""
	}
	return hardwareID
}

func stringsTrimDeviceHeader(c *gin.Context) string {
	deviceID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return ""
	}
	return deviceID
}
