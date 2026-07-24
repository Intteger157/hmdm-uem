package db

import (
	"errors"
	"log"
	"strings"
	"time"

	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

type legacySoftwareApp struct {
	ID              uint `gorm:"primaryKey"`
	Name            string
	Version         string
	DownloadURL     string
	InstallArgs     string
	AppType         string
	WingetID        string
	AutoUpdate      bool
	UpdateFrequency string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

func (legacySoftwareApp) TableName() string {
	return "software_apps"
}

// legacySharedApplication mirrors Android's applications table shape (read-only during migration).
type legacySharedApplication struct {
	ID        uint `gorm:"primaryKey"`
	Name      string
	Publisher string
	CreatedAt time.Time
}

func (legacySharedApplication) TableName() string {
	return "applications"
}

// legacyGoApplicationVersion is the old Go table name before windows isolation.
type legacyGoApplicationVersion struct {
	ID              uint `gorm:"primaryKey"`
	AppID           uint
	Version         string
	FileURL         string `gorm:"column:file_url"`
	InstallArgs     string
	AppType         string
	WingetID        string
	AutoUpdate      bool
	UpdateFrequency string
	IsActive        bool
	UploadedAt      time.Time
	UpdatedAt       time.Time
}

func (legacyGoApplicationVersion) TableName() string {
	return "application_versions"
}

func migrateWindowsApplicationData(database *gorm.DB) error {
	if err := migrateSoftwareAppsToWindowsApplications(database); err != nil {
		return err
	}
	if err := migrateLegacyGoApplicationVersions(database); err != nil {
		return err
	}
	if err := cleanupLegacyGoApplicationVersions(database); err != nil {
		return err
	}
	return nil
}

func migrateSoftwareAppsToWindowsApplications(database *gorm.DB) error {
	if !database.Migrator().HasTable("software_apps") {
		return nil
	}

	var legacyCount int64
	if err := database.Model(&legacySoftwareApp{}).Count(&legacyCount).Error; err != nil {
		return err
	}
	if legacyCount == 0 {
		return nil
	}

	var appCount int64
	if err := database.Model(&models.Application{}).Count(&appCount).Error; err != nil {
		return err
	}
	if appCount > 0 {
		return nil
	}

	var legacyRows []legacySoftwareApp
	if err := database.Order("id ASC").Find(&legacyRows).Error; err != nil {
		return err
	}

	oldToNewAppID := make(map[uint]uint, len(legacyRows))
	nameToAppID := make(map[string]uint, len(legacyRows))

	return database.Transaction(func(tx *gorm.DB) error {
		for _, row := range legacyRows {
			key := strings.ToLower(strings.TrimSpace(row.Name))
			appID, ok := nameToAppID[key]
			if !ok {
				app := models.Application{
					ID:        row.ID,
					Name:      strings.TrimSpace(row.Name),
					CreatedAt: row.CreatedAt,
				}
				if app.CreatedAt.IsZero() {
					app.CreatedAt = time.Now()
				}
				if err := tx.Create(&app).Error; err != nil {
					return err
				}
				appID = app.ID
				nameToAppID[key] = appID
			}
			oldToNewAppID[row.ID] = appID

			version := models.ApplicationVersion{
				AppID:           appID,
				Version:         strings.TrimSpace(row.Version),
				FileURL:         strings.TrimSpace(row.DownloadURL),
				InstallArgs:     strings.TrimSpace(row.InstallArgs),
				AppType:         normalizeLegacyAppType(row.AppType),
				WingetID:        strings.TrimSpace(row.WingetID),
				AutoUpdate:      row.AutoUpdate,
				UpdateFrequency: strings.TrimSpace(row.UpdateFrequency),
				IsActive:        true,
				UploadedAt:      row.UpdatedAt,
				UpdatedAt:       row.UpdatedAt,
			}
			if version.UploadedAt.IsZero() {
				version.UploadedAt = row.CreatedAt
			}
			if version.UpdatedAt.IsZero() {
				version.UpdatedAt = version.UploadedAt
			}
			if err := tx.Create(&version).Error; err != nil {
				return err
			}
		}

		for oldID, newID := range oldToNewAppID {
			if oldID == newID {
				continue
			}
			if err := tx.Model(&models.ProfileApp{}).Where("app_id = ?", oldID).Update("app_id", newID).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.WindowsDeviceApp{}).Where("app_id = ?", oldID).Update("app_id", newID).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.DeviceAppStatus{}).Where("app_id = ?", oldID).Update("app_id", newID).Error; err != nil {
				return err
			}
		}

		if err := tx.Migrator().DropTable("software_apps"); err != nil {
			return err
		}

		log.Printf("[db] migrated %d software_apps rows into windows_applications/windows_application_versions", legacyCount)
		return nil
	})
}

func migrateLegacyGoApplicationVersions(database *gorm.DB) error {
	if !database.Migrator().HasTable("application_versions") {
		return nil
	}

	var legacyVersions []legacyGoApplicationVersion
	if err := database.Find(&legacyVersions).Error; err != nil {
		return err
	}
	if len(legacyVersions) == 0 {
		return nil
	}

	nameToWindowsAppID := map[string]uint{}
	var existingApps []models.Application
	if err := database.Find(&existingApps).Error; err != nil {
		return err
	}
	for _, app := range existingApps {
		nameToWindowsAppID[strings.ToLower(strings.TrimSpace(app.Name))] = app.ID
	}

	migrated := 0
	return database.Transaction(func(tx *gorm.DB) error {
		for _, legacy := range legacyVersions {
			if !isWindowsLegacyVersion(legacy) {
				continue
			}

			appName, err := resolveLegacyApplicationName(tx, legacy.AppID)
			if err != nil {
				return err
			}
			if appName == "" {
				continue
			}

			appID, err := findOrCreateWindowsApplicationByName(tx, nameToWindowsAppID, appName)
			if err != nil {
				return err
			}

			version := models.ApplicationVersion{
				AppID:           appID,
				Version:         strings.TrimSpace(legacy.Version),
				FileURL:         strings.TrimSpace(legacy.FileURL),
				InstallArgs:     strings.TrimSpace(legacy.InstallArgs),
				AppType:         normalizeLegacyAppType(legacy.AppType),
				WingetID:        strings.TrimSpace(legacy.WingetID),
				AutoUpdate:      legacy.AutoUpdate,
				UpdateFrequency: strings.TrimSpace(legacy.UpdateFrequency),
				IsActive:        legacy.IsActive,
				UploadedAt:      legacy.UploadedAt,
				UpdatedAt:       legacy.UpdatedAt,
			}
			if version.UploadedAt.IsZero() {
				version.UploadedAt = time.Now()
			}
			if version.UpdatedAt.IsZero() {
				version.UpdatedAt = version.UploadedAt
			}
			if version.Version == "" {
				version.Version = "1.0.0"
			}

			var duplicate int64
			if err := tx.Model(&models.ApplicationVersion{}).
				Where("app_id = ? AND version = ? AND file_url = ?", appID, version.Version, version.FileURL).
				Count(&duplicate).Error; err != nil {
				return err
			}
			if duplicate > 0 {
				continue
			}

			if err := tx.Create(&version).Error; err != nil {
				return err
			}
			migrated++
		}

		if migrated > 0 {
			log.Printf("[db] migrated %d legacy application_versions rows into windows_application_versions", migrated)
		}
		return nil
	})
}

func cleanupLegacyGoApplicationVersions(database *gorm.DB) error {
	if !database.Migrator().HasTable("application_versions") {
		return nil
	}

	result := database.Exec(`
		DELETE FROM application_versions
		WHERE COALESCE(file_url, '') = ''
		  AND COALESCE(install_args, '') = ''
		  AND COALESCE(winget_id, '') = ''
		  AND COALESCE(version, '') = ''
	`)
	if result.Error != nil {
		return result.Error
	}

	result = database.Exec(`
		DELETE FROM application_versions
		WHERE uploaded_at IS NULL OR uploaded_at < TIMESTAMP '1970-01-02'
	`)
	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected > 0 {
		log.Printf("[db] removed %d erroneous application_versions rows created before Windows isolation", result.RowsAffected)
	}

	remaining := int64(0)
	if err := database.Table("application_versions").Count(&remaining).Error; err != nil {
		return err
	}
	if remaining == 0 {
		if err := database.Migrator().DropTable("application_versions"); err != nil {
			return err
		}
		log.Printf("[db] dropped empty legacy application_versions table")
	} else if remaining > 0 {
		log.Printf("[db] warning: %d application_versions rows remain after cleanup; review manually", remaining)
	}

	return nil
}

func isWindowsLegacyVersion(version legacyGoApplicationVersion) bool {
	if strings.TrimSpace(version.FileURL) != "" {
		return true
	}
	if strings.TrimSpace(version.InstallArgs) != "" {
		return true
	}
	if strings.TrimSpace(version.WingetID) != "" {
		return true
	}
	switch normalizeLegacyAppType(version.AppType) {
	case models.AppTypeUpload, models.AppTypeURL, models.AppTypeWinget:
		return strings.TrimSpace(version.AppType) != ""
	default:
		return false
	}
}

func resolveLegacyApplicationName(tx *gorm.DB, appID uint) (string, error) {
	var shared legacySharedApplication
	err := tx.First(&shared, appID).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return "", nil
		}
		return "", err
	}
	return strings.TrimSpace(shared.Name), nil
}

func findOrCreateWindowsApplicationByName(tx *gorm.DB, cache map[string]uint, name string) (uint, error) {
	key := strings.ToLower(strings.TrimSpace(name))
	if appID, ok := cache[key]; ok {
		return appID, nil
	}

	var existing models.Application
	err := tx.Where("LOWER(name) = LOWER(?)", name).First(&existing).Error
	if err == nil {
		cache[key] = existing.ID
		return existing.ID, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	app := models.Application{
		Name:      strings.TrimSpace(name),
		CreatedAt: time.Now(),
	}
	if err := tx.Create(&app).Error; err != nil {
		return 0, err
	}
	cache[key] = app.ID
	return app.ID, nil
}

func normalizeLegacyAppType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case models.AppTypeUpload:
		return models.AppTypeUpload
	case models.AppTypeWinget:
		return models.AppTypeWinget
	default:
		return models.AppTypeURL
	}
}
