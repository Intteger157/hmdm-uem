package handlers

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func findApplicationByName(name string) (models.Application, error) {
	trimmed := strings.TrimSpace(name)
	var app models.Application
	err := db.DB.Where("LOWER(name) = LOWER(?)", trimmed).First(&app).Error
	return app, err
}

func loadApplicationVersions(appID uint) ([]models.ApplicationVersion, error) {
	var versions []models.ApplicationVersion
	if err := db.DB.Where("app_id = ?", appID).Order("uploaded_at DESC, id DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	return versions, nil
}

func loadVersionsByAppIDs(appIDs []uint) (map[uint][]models.ApplicationVersion, error) {
	result := make(map[uint][]models.ApplicationVersion)
	if len(appIDs) == 0 {
		return result, nil
	}

	var versions []models.ApplicationVersion
	if err := db.DB.Where("app_id IN ?", appIDs).Order("uploaded_at DESC, id DESC").Find(&versions).Error; err != nil {
		return nil, err
	}
	for _, version := range versions {
		result[version.AppID] = append(result[version.AppID], version)
	}
	return result, nil
}

func resolveApplicationVersion(appID uint, versionID *uint) (models.ApplicationVersion, models.Application, error) {
	var app models.Application
	if err := db.DB.First(&app, appID).Error; err != nil {
		return models.ApplicationVersion{}, models.Application{}, err
	}

	if versionID != nil && *versionID > 0 {
		var version models.ApplicationVersion
		if err := db.DB.Where("id = ? AND app_id = ?", *versionID, appID).First(&version).Error; err != nil {
			return models.ApplicationVersion{}, models.Application{}, err
		}
		return version, app, nil
	}

	version, err := latestActiveApplicationVersion(appID)
	if err != nil {
		return models.ApplicationVersion{}, models.Application{}, err
	}
	return version, app, nil
}

func latestActiveApplicationVersion(appID uint) (models.ApplicationVersion, error) {
	var version models.ApplicationVersion
	err := db.DB.
		Where("app_id = ? AND is_active = ?", appID, true).
		Order("uploaded_at DESC, id DESC").
		First(&version).Error
	if err == nil {
		return version, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.ApplicationVersion{}, err
	}

	err = db.DB.Where("app_id = ?", appID).Order("uploaded_at DESC, id DESC").First(&version).Error
	return version, err
}

func applicationVersionToRequiredApp(app models.Application, version models.ApplicationVersion) models.RequiredApp {
	appType := version.AppType
	if appType == "" {
		appType = models.AppTypeURL
	}
	updatedAt := version.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = version.UploadedAt
	}
	return models.RequiredApp{
		ID:              app.ID,
		VersionID:       version.ID,
		Name:            app.Name,
		Version:         version.Version,
		ExpectedVersion: version.Version,
		UpdatedAt:       updatedAt,
		DownloadURL:     normalizeDownloadURL(version.FileURL),
		InstallArgs:     version.InstallArgs,
		AppType:         appType,
		WingetID:        version.WingetID,
		AutoUpdate:      version.AutoUpdate,
		UpdateFrequency: version.UpdateFrequency,
	}
}

func createUploadedApplicationVersion(
	app models.Application,
	isNewApp bool,
	version string,
	fileURL string,
	installArgs string,
) (models.ApplicationVersion, error) {
	now := time.Now()
	record := models.ApplicationVersion{
		AppID:       app.ID,
		Version:     strings.TrimSpace(version),
		FileURL:     strings.TrimSpace(fileURL),
		InstallArgs: strings.TrimSpace(installArgs),
		AppType:     models.AppTypeUpload,
		IsActive:    true,
		UploadedAt:  now,
		UpdatedAt:   now,
	}
	if record.Version == "" {
		record.Version = "1.0.0"
	}

	if err := db.DB.Create(&record).Error; err != nil {
		return models.ApplicationVersion{}, err
	}
	_ = isNewApp
	return record, nil
}

func findOrCreateApplicationByName(name string) (models.Application, bool, error) {
	app, err := findApplicationByName(name)
	if err == nil {
		return app, false, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return models.Application{}, false, err
	}

	app = models.Application{
		Name:      strings.TrimSpace(name),
		CreatedAt: time.Now(),
	}
	if app.Name == "" {
		return models.Application{}, false, fmt.Errorf("application name is required")
	}
	if err := db.DB.Create(&app).Error; err != nil {
		return models.Application{}, false, err
	}
	return app, true, nil
}

func applyVersionUpsertRequest(version *models.ApplicationVersion, req models.CreateApplicationVersionRequest) error {
	appType := normalizeAppType(req.AppType)
	version.Version = strings.TrimSpace(req.Version)
	version.InstallArgs = strings.TrimSpace(req.InstallArgs)
	version.AppType = appType
	version.WingetID = strings.TrimSpace(req.WingetID)
	version.AutoUpdate = req.AutoUpdate
	version.UpdateFrequency = strings.ToLower(strings.TrimSpace(req.UpdateFrequency))

	switch appType {
	case models.AppTypeWinget:
		if version.WingetID == "" {
			return fmt.Errorf("wingetId is required for winget apps")
		}
		version.FileURL = strings.TrimSpace(req.FileURL)
	case models.AppTypeUpload, models.AppTypeURL:
		fileURL := strings.TrimSpace(req.FileURL)
		if fileURL == "" {
			return fmt.Errorf("downloadUrl is required")
		}
		version.FileURL = fileURL
		version.WingetID = ""
	}

	if appType == models.AppTypeUpload {
		version.AutoUpdate = false
		version.UpdateFrequency = ""
	}

	if version.AutoUpdate {
		switch version.UpdateFrequency {
		case models.UpdateFrequencyDaily, models.UpdateFrequencyWeekly:
		default:
			return fmt.Errorf("updateFrequency must be daily or weekly when autoUpdate is enabled")
		}
	} else {
		version.UpdateFrequency = ""
	}

	if strings.TrimSpace(version.Version) == "" {
		version.Version = "1.0.0"
	}
	return nil
}

func normalizeProfileAssignments(req models.AssignProfileAppsRequest) []models.ProfileAppAssignment {
	if len(req.Assignments) > 0 {
		return dedupeProfileAssignments(req.Assignments)
	}
	assignments := make([]models.ProfileAppAssignment, 0, len(req.AppIDs))
	for _, appID := range uniqueUints(req.AppIDs) {
		assignments = append(assignments, models.ProfileAppAssignment{AppID: appID})
	}
	return assignments
}

func dedupeProfileAssignments(items []models.ProfileAppAssignment) []models.ProfileAppAssignment {
	seen := make(map[uint]struct{})
	result := make([]models.ProfileAppAssignment, 0, len(items))
	for _, item := range items {
		if item.AppID == 0 {
			continue
		}
		if _, ok := seen[item.AppID]; ok {
			continue
		}
		seen[item.AppID] = struct{}{}
		result = append(result, item)
	}
	return result
}

func validateApplicationAssignments(assignments []models.ProfileAppAssignment) error {
	if len(assignments) == 0 {
		return nil
	}

	appIDs := make([]uint, 0, len(assignments))
	for _, item := range assignments {
		appIDs = append(appIDs, item.AppID)
	}

	var count int64
	if err := db.DB.Model(&models.Application{}).Where("id IN ?", appIDs).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(uniqueUints(appIDs)) {
		return gorm.ErrRecordNotFound
	}

	for _, item := range assignments {
		if item.VersionID == nil || *item.VersionID == 0 {
			continue
		}
		var versionCount int64
		if err := db.DB.Model(&models.ApplicationVersion{}).
			Where("id = ? AND app_id = ?", *item.VersionID, item.AppID).
			Count(&versionCount).Error; err != nil {
			return err
		}
		if versionCount == 0 {
			return gorm.ErrRecordNotFound
		}
	}
	return nil
}

func isApplicationVersionInUse(appID, versionID uint) (bool, error) {
	var profileCount int64
	if err := db.DB.Model(&models.ProfileApp{}).
		Where("app_id = ? AND version_id = ?", appID, versionID).
		Count(&profileCount).Error; err != nil {
		return false, err
	}
	if profileCount > 0 {
		return true, nil
	}

	var deviceAppCount int64
	if err := db.DB.Model(&models.WindowsDeviceApp{}).
		Where("app_id = ? AND version_id = ?", appID, versionID).
		Count(&deviceAppCount).Error; err != nil {
		return false, err
	}
	return deviceAppCount > 0, nil
}

func shouldDeleteStoredInstaller(version models.ApplicationVersion) bool {
	if version.AppType == models.AppTypeUpload {
		return true
	}
	return strings.Contains(strings.TrimSpace(version.FileURL), "/storage/apps/")
}
