package handlers

import (
	"strconv"
	"strings"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// findWindowsDeviceByIdentifier resolves a device by public identifier: hardware_id (UUID)
// or numeric primary key when the path segment is a plain integer.
func findWindowsDeviceByIdentifier(identifier string) (models.WindowsDevice, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return models.WindowsDevice{}, gorm.ErrRecordNotFound
	}

	var device models.WindowsDevice
	query := db.DB.Where("hardware_id = ?", identifier)
	if id, ok := parseUnsignedDeviceID(identifier); ok {
		query = db.DB.Where("hardware_id = ? OR id = ?", identifier, id)
	}

	if err := query.First(&device).Error; err != nil {
		return models.WindowsDevice{}, err
	}

	return device, nil
}

func parseUnsignedDeviceID(value string) (uint, bool) {
	id, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil || id == 0 {
		return 0, false
	}
	return uint(id), true
}
