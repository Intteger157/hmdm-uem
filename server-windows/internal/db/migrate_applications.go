package db

import (
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

func migrateSoftwareAppsToApplications(database *gorm.DB) error {
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

		log.Printf("[db] migrated %d software_apps rows into applications/application_versions", legacyCount)
		return nil
	})
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
