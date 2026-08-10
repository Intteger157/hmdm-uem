package handlers

import (
	"errors"
	"log"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func applyExclusiveDefaultGroup(tx *gorm.DB, groupID uint, isDefault bool) error {
	if isDefault {
		if err := tx.Model(&models.WindowsDeviceGroup{}).
			Where("id <> ?", groupID).
			Update("is_default", false).Error; err != nil {
			return err
		}
	}
	return tx.Model(&models.WindowsDeviceGroup{}).
		Where("id = ?", groupID).
		Update("is_default", isDefault).Error
}

func findDefaultDeviceGroup() (models.WindowsDeviceGroup, bool, error) {
	var group models.WindowsDeviceGroup
	err := db.DB.Where("is_default = ?", true).Order("id ASC").First(&group).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.WindowsDeviceGroup{}, false, nil
	}
	if err != nil {
		return models.WindowsDeviceGroup{}, false, err
	}
	return group, true, nil
}

func applyDefaultGroupToNewDevice(device *models.WindowsDevice) error {
	if device == nil {
		return nil
	}

	group, ok, err := findDefaultDeviceGroup()
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}

	groupID := group.ID
	device.GroupID = &groupID
	log.Printf("[default-group] will assign group_id=%d name=%q during device creation", group.ID, group.Name)
	return nil
}
