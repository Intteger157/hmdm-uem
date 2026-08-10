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

	if len(response.AppliedProfiles) == 0 && len(response.RequiredApps) == 0 && len(response.FileDeployments) == 0 {
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
			UpdatedAt:   entry.Profile.UpdatedAt,
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
			UpdatedAt:   entry.Profile.UpdatedAt,
		})
	}

	merged := models.MergeConfigPayloads(groupPayloads, directPayloads)

	loadedProfiles := profilesFromAssignmentEntries(groupEntries, directEntries)

	requiredApps, err := requiredAppsFromProfiles(loadedProfiles)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	directApps, err := loadDirectAssignedApps(device.ID)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	mergedApps := mergeRequiredApps(requiredApps, directApps)
	filteredApps, err := excludeTerminalAppStatuses(device.ID, mergedApps)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	fileDeployments, err := fileDeploymentsFromProfiles(loadedProfiles)
	if err != nil {
		return models.EffectiveConfigResponse{}, err
	}

	response := models.EffectiveConfigResponse{
		Payload:         merged,
		RequiredApps:    filteredApps,
		FileDeployments: fileDeployments,
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

	profiles, err := loadActiveProfilesWithAssociations(profileIDs)
	if err != nil {
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

	profiles, err := loadActiveProfilesWithAssociations(profileIDs)
	if err != nil {
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

func loadActiveProfilesWithAssociations(profileIDs []uint) ([]models.WindowsConfigProfile, error) {
	if len(profileIDs) == 0 {
		return nil, nil
	}

	var profiles []models.WindowsConfigProfile
	if err := db.DB.
		Preload("RequiredApps", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("profile_id ASC, app_id ASC")
		}).
		Preload("FileDeploymentRules", func(tx *gorm.DB) *gorm.DB {
			return tx.Order("profile_id ASC, id ASC")
		}).
		Where("id IN ? AND is_active = ?", profileIDs, true).
		Order("id ASC").
		Find(&profiles).Error; err != nil {
		return nil, err
	}
	return profiles, nil
}

func profilesFromAssignmentEntries(groups, directs []profileAssignmentEntry) []models.WindowsConfigProfile {
	profiles := make([]models.WindowsConfigProfile, 0, len(groups)+len(directs))
	seen := make(map[uint]struct{}, len(groups)+len(directs))
	for _, entry := range groups {
		if _, ok := seen[entry.Profile.ID]; ok {
			continue
		}
		seen[entry.Profile.ID] = struct{}{}
		profiles = append(profiles, entry.Profile)
	}
	for _, entry := range directs {
		if _, ok := seen[entry.Profile.ID]; ok {
			continue
		}
		seen[entry.Profile.ID] = struct{}{}
		profiles = append(profiles, entry.Profile)
	}
	return profiles
}

func requiredAppsFromProfiles(profiles []models.WindowsConfigProfile) ([]models.RequiredApp, error) {
	if len(profiles) == 0 {
		return nil, nil
	}

	links := make([]models.ProfileApp, 0)
	for _, profile := range profiles {
		links = append(links, profile.RequiredApps...)
	}
	if len(links) == 0 {
		return nil, nil
	}

	return profileAppLinksToRequiredApps(links)
}

func loadRequiredAppsForProfiles(profileIDs []uint) ([]models.RequiredApp, error) {
	profiles, err := loadActiveProfilesWithAssociations(profileIDs)
	if err != nil {
		return nil, err
	}
	return requiredAppsFromProfiles(profiles)
}

func loadDirectAssignedApps(deviceID uint) ([]models.RequiredApp, error) {
	var links []models.WindowsDeviceApp
	if err := db.DB.Where("device_id = ?", deviceID).Order("app_id ASC").Find(&links).Error; err != nil {
		return nil, err
	}
	if len(links) == 0 {
		return nil, nil
	}

	required := make([]models.RequiredApp, 0, len(links))
	for _, link := range links {
		version, app, err := resolveApplicationVersion(link.AppID, link.VersionID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return nil, err
		}
		required = append(required, applicationVersionToRequiredApp(app, version))
	}
	return required, nil
}

func profileAppLinksToRequiredApps(links []models.ProfileApp) ([]models.RequiredApp, error) {
	seen := make(map[uint]struct{})
	required := make([]models.RequiredApp, 0, len(links))
	for _, link := range links {
		if _, ok := seen[link.AppID]; ok {
			continue
		}
		seen[link.AppID] = struct{}{}

		version, app, err := resolveApplicationVersion(link.AppID, link.VersionID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return nil, err
		}
		required = append(required, applicationVersionToRequiredApp(app, version))
	}
	return required, nil
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

func excludeTerminalAppStatuses(deviceID uint, apps []models.RequiredApp) ([]models.RequiredApp, error) {
	if len(apps) == 0 {
		return apps, nil
	}

	appIDs := make([]uint, 0, len(apps))
	appByID := make(map[uint]models.RequiredApp, len(apps))
	for _, app := range apps {
		appIDs = append(appIDs, app.ID)
		appByID[app.ID] = app
	}

	var statuses []models.DeviceAppStatus
	if err := db.DB.
		Where(
			"device_id = ? AND app_id IN ? AND status IN ?",
			deviceID,
			appIDs,
			[]string{models.AppStatusSuccess, models.AppStatusFailed, models.AppStatusCanceled, models.AppStatusTimeout},
		).
		Find(&statuses).Error; err != nil {
		return nil, err
	}
	if len(statuses) == 0 {
		return apps, nil
	}

	terminal := make(map[uint]struct{}, len(statuses))
	for _, status := range statuses {
		if shouldExcludeRequiredApp(appByID[status.AppID], status) {
			terminal[status.AppID] = struct{}{}
		}
	}

	filtered := make([]models.RequiredApp, 0, len(apps))
	for _, app := range apps {
		if _, skip := terminal[app.ID]; skip {
			continue
		}
		filtered = append(filtered, app)
	}
	return filtered, nil
}

func shouldExcludeRequiredApp(app models.RequiredApp, status models.DeviceAppStatus) bool {
	switch status.Status {
	case models.AppStatusSuccess:
		if status.AttemptedCatalogUpdatedAt == nil {
			return false
		}
		if app.ID == 0 {
			return true
		}
		return !app.UpdatedAt.After(status.AttemptedCatalogUpdatedAt.UTC())
	case models.AppStatusCanceled:
		return true
	case models.AppStatusTimeout:
		if status.AttemptedCatalogUpdatedAt == nil {
			return true
		}
		if app.ID == 0 {
			return true
		}
		return !app.UpdatedAt.After(status.AttemptedCatalogUpdatedAt.UTC())
	case models.AppStatusFailed:
		if status.AttemptedCatalogUpdatedAt == nil {
			return true
		}
		if app.ID == 0 {
			return true
		}
		return !app.UpdatedAt.After(status.AttemptedCatalogUpdatedAt.UTC())
	default:
		return false
	}
}

func loadMergedRequiredApps(device models.WindowsDevice) ([]models.RequiredApp, error) {
	groupEntries, err := loadGroupAssignedProfiles(device.GroupID)
	if err != nil {
		return nil, err
	}

	directEntries, err := loadDirectAssignedProfiles(device.ID)
	if err != nil {
		return nil, err
	}

	profileIDs := make([]uint, 0, len(groupEntries)+len(directEntries))
	for _, entry := range groupEntries {
		profileIDs = append(profileIDs, entry.Profile.ID)
	}
	for _, entry := range directEntries {
		profileIDs = append(profileIDs, entry.Profile.ID)
	}

	requiredApps, err := loadRequiredAppsForProfiles(profileIDs)
	if err != nil {
		return nil, err
	}

	directApps, err := loadDirectAssignedApps(device.ID)
	if err != nil {
		return nil, err
	}

	return mergeRequiredApps(requiredApps, directApps), nil
}

func excludeSuccessfulDirectApps(deviceID uint, apps []models.RequiredApp) ([]models.RequiredApp, error) {
	return excludeTerminalAppStatuses(deviceID, apps)
}
