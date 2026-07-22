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

	if err := database.AutoMigrate(&models.WindowsDevice{}); err != nil {
		return nil, fmt.Errorf("migrate database: %w", err)
	}

	DB = database
	return database, nil
}
