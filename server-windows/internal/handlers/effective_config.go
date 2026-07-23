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

type profileAssignmentEntry struct {
	Profile models.WindowsConfigProfile
	Source  string
}

// GetDeviceEffectiveConfig returns the merged effective policy payload for a device.
func (h *WindowsHandler) GetDeviceEffectiveConfig(c *gin.Context) {
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

	response, err := buildEffectiveConfig(device)
	if err != nil {
		log.Printf("[effective-config] build failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build effective configuration"})
		return
	}

	if len(response.AppliedProfiles) == 0 && len(response.RequiredApps) == 0 {
		c.Status(http.StatusNoContent)
		return
	}

	c.JSON(http.StatusOK, response)
}

func buildEffectiveConfig(device models.WindowsDevice) (models.EffectiveConfigResponse, error) {
	groupEntries, err := loadGroupAssignedProfiles(device.GroupID)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	directEntries, err := loadDirectAssignedProfiles(device.ID)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	groupPayloads := make([]models.WindowsConfigProfilePayload, 0, len(groupEntries))
	applied := make([]models.AppliedProfileSource, 0, len(groupEntries)+len(directEntries))

	for _, entry := range groupEntries {
		payload, decodeErr := models.DecodeConfigProfilePayload(entry.Profile.Payload)
		if decodeErr != nil {
			return models.EffectiveConfigResponse{}, decodeErr
		}
		groupPayloads = append(groupPayloads, payload)
		applied = append(applied, models.AppliedProfileSource{
			ProfileID:   entry.Profile.ID,
			ProfileName: entry.Profile.Name,
			Source:      entry.Source,
		})
	}

	directPayloads := make([]models.WindowsConfigProfilePayload, 0, len(directEntries))
	for _, entry := range directEntries {
		payload, decodeErr := models.DecodeConfigProfilePayload(entry.Profile.Payload)
		if decodeErr != nil {
			return models.EffectiveConfigResponse{}, decodeErr
		}
		directPayloads = append(directPayloads, payload)
		applied = append(applied, models.AppliedProfileSource{
			ProfileID:   entry.Profile.ID,
			ProfileName: entry.Profile.Name,
			Source:      entry.Source,
		})
	}

	merged := models.MergeConfigPayloads(groupPayloads, directPayloads)

	profileIDs := make([]uint, 0, len(applied))
	for _, entry := range applied {
		profileIDs = append(profileIDs, entry.ProfileID)
	}

	requiredApps, err := loadRequiredAppsForProfiles(profileIDs)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	directApps, err := loadDirectAssignedApps(device.ID)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	response := models.EffectiveConfigResponse{
		Payload:         merged,
		RequiredApps:    mergeRequiredApps(requiredApps, directApps),
		AppliedProfiles: applied,
	}

	if len(directEntries) > 0 {
		last := directEntries[len(directEntries)-1]
		response.ProfileID = last.Profile.ID
		response.ProfileName = last.Profile.Name
		response.Source = models.AssignmentSourceDirect
	} else if len(groupEntries) > 0 {
		last := groupEntries[len(groupEntries)-1]
		response.ProfileID = last.Profile.ID
		response.ProfileName = last.Profile.Name
		response.Source = models.AssignmentSourceGroup
	}

	return response, nil
}

func loadGroupAssignedProfiles(groupID *uint) ([]profileAssignmentEntry, error) {
	if groupID == nil || *groupID == 0 {
		return nil, nil
	}

	var links []models.WindowsProfileGroup
	if err := db.DB.Where("group_id = ?", *groupID).Order("profile_id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return nil, nil
	}

	profileIDs := make([]uint, 0, len(links))
	for _, link := range links {
		profileIDs = append(profileIDs, link.ProfileID)
	}

	var profiles []models.WindowsConfigProfile
	if err := db.DB.Where("id IN ? AND is_active = ?", profileIDs, true).Order("id ASC").Find(&profiles).Error; err != nil {
		return nil, err
	}

	entries := make([]profileAssignmentEntry, 0, len(profiles))
	for _, profile := range profiles {
		entries = append(entries, profileAssignmentEntry{
			Profile: profile,
			Source:  models.AssignmentSourceGroup,
		})
	}
	return entries, nil
}

func loadDirectAssignedProfiles(deviceID uint) ([]profileAssignmentEntry, error) {
	var links []models.WindowsProfileDevice
	if err := db.DB.Where("device_id = ?", deviceID).Order("profile_id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return nil, nil
	}

	profileIDs := make([]uint, 0, len(links))
	for _, link := range links {
		profileIDs = append(profileIDs, link.ProfileID)
	}

	var profiles []models.WindowsConfigProfile
	if err := db.DB.Where("id IN ? AND is_active = ?", profileIDs, true).Order("id ASC").Find(&profiles).Error; err != nil {
		return nil, err
	}

	entries := make([]profileAssignmentEntry, 0, len(profiles))
	for _, profile := range profiles {
		entries = append(entries, profileAssignmentEntry{
			Profile: profile,
			Source:  models.AssignmentSourceDirect,
		})
	}
	return entries, nil
}

func loadRequiredAppsForProfiles(profileIDs []uint) ([]models.RequiredApp, error) {
	if len(profileIDs) == 0 {
		return nil, nil
	}

	var links []models.ProfileApp
	if err := db.DB.Where("profile_id IN ?", profileIDs).Order("profile_id ASC, app_id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return nil, nil
	}

	appIDs := make([]uint, 0, len(links))
	seen := make(map[uint]struct{}, len(links))
	for _, link := range links {
		if _, ok := seen[link.AppID]; ok {
			continue
		}
		seen[link.AppID] = struct{}{}
		appIDs = append(appIDs, link.AppID)
	}

	var apps []models.SoftwareApp
	if err := db.DB.Where("id IN ?", appIDs).Order("id ASC").Find(&apps).Error; err != nil {
		return nil, err
	}

	return softwareAppsToRequiredApps(apps), nil
}

func loadDirectAssignedApps(deviceID uint) ([]models.RequiredApp, error) {
	var links []models.WindowsDeviceApp
	if err := db.DB.Where("device_id = ?", deviceID).Order("app_id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return nil, nil
	}

	appIDs := make([]uint, 0, len(links))
	for _, link := range links {
		appIDs = append(appIDs, link.AppID)
	}

	var apps []models.SoftwareApp
	if err := db.DB.Where("id IN ?", appIDs).Order("id ASC").Find(&apps).Error; err != nil {
		return nil, err
	}

	return softwareAppsToRequiredApps(apps), nil
}

func softwareAppsToRequiredApps(apps []models.SoftwareApp) []models.RequiredApp {
	required := make([]models.RequiredApp, 0, len(apps))
	for _, app := range apps {
		appType := app.AppType
		if appType == "" {
			appType = models.AppTypeURL
		}
		required = append(required, models.RequiredApp{
			ID:              app.ID,
			Name:            app.Name,
			Version:         app.Version,
			DownloadURL:     normalizeDownloadURL(app.DownloadURL),
			InstallArgs:     app.InstallArgs,
			AppType:         appType,
			WingetID:        app.WingetID,
			AutoUpdate:      app.AutoUpdate,
			UpdateFrequency: app.UpdateFrequency,
		})
	}
	return required
}

func mergeRequiredApps(lists ...[]models.RequiredApp) []models.RequiredApp {
	seen := make(map[uint]struct{})
	merged := make([]models.RequiredApp, 0)
	for _, list := range lists {
		for _, app := range list {
			if _, ok := seen[app.ID]; ok {
				continue
			}
			seen[app.ID] = struct{}{}
			merged = append(merged, app)
		}
	}
	return merged
}
