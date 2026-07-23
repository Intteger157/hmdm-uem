package db

import (
	"fmt"

	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// DB is the shared PostgreSQL connection used by HTTP handlers.
var DB *gorm.DB

// InitDB connects to PostgreSQL and runs schema migrations.
func InitDB(dsn string) (*gorm.DB, error) {
	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("connect database: %w", err)
	}

	normalizeEnrollmentDownloadTokens(database)

	if err := database.AutoMigrate(
		&models.WindowsDevice{},
		&models.WindowsDeviceCommand{},
		&models.DeviceCommandLog{},
		&models.WindowsEnrollmentToken{},
		&models.WindowsAgentInstaller{},
		&models.WindowsConfigProfile{},
		&models.WindowsDeviceGroup{},
		&models.WindowsProfileDevice{},
		&models.WindowsProfileGroup{},
	); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}

	normalizeEnrollmentDownloadTokens(database)

	DB = database
	return database, nil
}

func normalizeEnrollmentDownloadTokens(database *gorm.DB) {
	database.Exec(`
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1 FROM information_schema.columns
				WHERE table_name = 'windows_enrollment_tokens'
				  AND column_name = 'download_token'
			) THEN
				UPDATE windows_enrollment_tokens
				SET download_token = NULL
				WHERE download_token = '';
			END IF;
		END $$;
	`)
}
