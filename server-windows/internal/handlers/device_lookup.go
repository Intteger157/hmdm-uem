package handlers

import (
	"errors"
	"log"
	"strconv"
	"strings"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// findWindowsDeviceByIdentifier resolves a device by public identifier.
// Agent tray URLs use the machine UUID stored in hardware_id (HostID).
func findWindowsDeviceByIdentifier(identifier string) (models.WindowsDevice, error) {
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return models.WindowsDevice{}, gorm.ErrRecordNotFound
	}

	normalized := strings.ToLower(identifier)

	var device models.WindowsDevice
	query := db.DB.Where("LOWER(hardware_id) = ?", normalized)

	if id, ok := parseUnsignedDeviceID(identifier); ok {
		query = db.DB.Where("LOWER(hardware_id) = ? OR id = ?", normalized, id)
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

func logPublicDeviceLookup(identifier string, device models.WindowsDevice, err error) {
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[Public API] Device not found in DB for id=%q", identifier)
			return
		}
		log.Printf("[Public API] Device lookup failed for id=%q err=%v", identifier, err)
		return
	}

	log.Printf(
		"[Public API] Device found id=%q hardware_id=%q hostname=%q manufacturer=%q model=%q",
		identifier,
		device.HardwareID,
		strings.TrimSpace(device.Hostname),
		strings.TrimSpace(device.Manufacturer),
		strings.TrimSpace(device.Model),
	)
}
