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

	assignments, err := listAssignedProfileApps(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load profile apps"})
		return
	}

	c.JSON(http.StatusOK, models.ProfileAppsResponse{
		AppIDs:      appIDs,
		Assignments: assignments,
	})
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

	if err := validateApplicationAssignments(normalizeProfileAssignments(req)); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one or more apps or versions were not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	assignments := normalizeProfileAssignments(req)

	if err := replaceProfileApps(profileID, assignments); err != nil {
		if respondSaveProfileAppsError(c, profileID, "assign-profile-apps", err) {
			return
		}
	}

	log.Printf("[assign-profile-apps] profile_id=%d apps=%d", profileID, len(assignments))
	c.JSON(http.StatusOK, models.ProfileAppsResponse{
		AppIDs:      assignmentAppIDs(assignments),
		Assignments: assignments,
	})
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

func listAssignedProfileApps(profileID uint) ([]models.ProfileAppAssignment, error) {
	var rows []models.ProfileApp
	if err := db.DB.Where("profile_id = ?", profileID).Order("app_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	assignments := make([]models.ProfileAppAssignment, 0, len(rows))
	for _, row := range rows {
		assignments = append(assignments, models.ProfileAppAssignment{
			AppID:     row.AppID,
			VersionID: row.VersionID,
		})
	}
	return assignments, nil
}

func assignmentAppIDs(assignments []models.ProfileAppAssignment) []uint {
	ids := make([]uint, 0, len(assignments))
	for _, assignment := range assignments {
		ids = append(ids, assignment.AppID)
	}
	return uniqueUints(ids)
}

func deleteConfigProfileApps(profileID uint) error {
	return db.DB.Where("profile_id = ?", profileID).Delete(&models.ProfileApp{}).Error
}

func replaceProfileApps(profileID uint, assignments []models.ProfileAppAssignment) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		return replaceProfileAppsTx(tx, profileID, assignments)
	})
}

func replaceProfileAppsTx(tx *gorm.DB, profileID uint, assignments []models.ProfileAppAssignment) error {
	previousAppIDs, err := listAssignedAppIDsTx(tx, profileID)
	if err != nil {
		return err
	}
	removed := removedAppIDs(previousAppIDs, assignmentAppIDs(assignments))
	if err := cancelPendingAppInstallsForRemovedApps(tx, profileID, removed); err != nil {
		return err
	}

	if err := tx.Where("profile_id = ?", profileID).Delete(&models.ProfileApp{}).Error; err != nil {
		return err
	}
	for _, assignment := range assignments {
		row := models.ProfileApp{
			ProfileID: profileID,
			AppID:     assignment.AppID,
			VersionID: assignment.VersionID,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
	}
	return tx.Model(&models.WindowsConfigProfile{}).Where("id = ?", profileID).Update("updated_at", time.Now()).Error
}

func saveProfileAppsForRequest(profileID uint, req models.UpsertConfigProfileRequest) error {
	if !req.RequiredAppsProvided() {
		return nil
	}

	assignments, err := req.NormalizedAssignments()
	if err != nil {
		return err
	}
	if err := validateApplicationAssignments(assignments); err != nil {
		return err
	}
	return replaceProfileApps(profileID, assignments)
}

func respondSaveProfileAppsError(c *gin.Context, profileID uint, action string, err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "one or more apps or versions were not found"})
		return true
	}
	if isProfileAppsValidationError(err) {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return true
	}
	log.Printf("[%s] save apps failed: id=%d err=%v", action, profileID, err)
	c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	return true
}

func isProfileAppsValidationError(err error) bool {
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "invalid version_policy") ||
		strings.Contains(message, "app id is required") ||
		strings.Contains(message, "must be a")
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

	mergedApps, err := loadMergedRequiredApps(device)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load assigned apps"})
		return
	}

	if err := expireStaleAppDeployments(device.ID); err != nil {
		log.Printf("[get-app-statuses] stale deployment sweep failed: device_id=%d err=%v", device.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load app statuses"})
		return
	}

	items, err := buildDeviceAppStatusList(device.ID, mergedApps)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load app statuses"})
		return
	}

	c.JSON(http.StatusOK, models.DeviceAppStatusListResponse{
		Items:         items,
		RequiredTotal: len(mergedApps),
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

	var app models.Application
	if err := db.DB.First(&app, req.AppID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
		return
	}

	if err := upsertDeviceAppStatus(device.ID, req.AppID, status, req.Error, catalogUpdatedAtForDeviceApp(device, req.AppID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save app status"})
		return
	}

	log.Printf("[report-app-status] device_id=%d app_id=%d status=%q", device.ID, req.AppID, status)
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
		models.AppStatusFailed,
		models.AppStatusCanceled,
		models.AppStatusSkipped:
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
