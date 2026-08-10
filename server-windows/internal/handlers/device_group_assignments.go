package handlers

import (
	"errors"
	"fmt"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func normalizeDeviceGroupDeviceIDs(deviceIDs []uint) []uint {
	if len(deviceIDs) == 0 {
		return nil
	}
	seen := make(map[uint]struct{}, len(deviceIDs))
	result := make([]uint, 0, len(deviceIDs))
	for _, id := range deviceIDs {
		if id == 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func listDeviceIDsForGroup(groupID uint) ([]uint, error) {
	var deviceIDs []uint
	if err := db.DB.Model(&models.WindowsDevice{}).
		Where("group_id = ?", groupID).
		Order("id ASC").
		Pluck("id", &deviceIDs).Error; err != nil {
		return nil, err
	}
	return deviceIDs, nil
}

func buildDeviceGroupJSON(group models.WindowsDeviceGroup) (models.DeviceGroupJSON, error) {
	item := models.DeviceGroupJSON{
		ID:          group.ID,
		Name:        group.Name,
		Description: group.Description,
		IsDefault:   group.IsDefault,
		DeviceCount: countDevicesByGroup([]uint{group.ID})[group.ID],
	}
	if profile, ok := lookupGroupProfiles([]uint{group.ID})[group.ID]; ok {
		item.ConfigurationID = profile.ID
		item.ConfigurationName = profile.Name
	}
	return item, nil
}

func buildDeviceGroupDetailJSON(group models.WindowsDeviceGroup) (models.DeviceGroupJSON, error) {
	item, err := buildDeviceGroupJSON(group)
	if err != nil {
		return item, err
	}
	deviceIDs, err := listDeviceIDsForGroup(group.ID)
	if err != nil {
		return item, err
	}
	item.DeviceIDs = deviceIDs
	return item, nil
}

func applyGroupAssignments(tx *gorm.DB, groupID uint, configurationID *uint, deviceIDs []uint) error {
	deviceIDs = normalizeDeviceGroupDeviceIDs(deviceIDs)

	if configurationID != nil && *configurationID > 0 {
		var profile models.WindowsConfigProfile
		if err := tx.First(&profile, *configurationID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("configuration profile not found")
			}
			return err
		}
	}

	if len(deviceIDs) > 0 {
		var count int64
		if err := tx.Model(&models.WindowsDevice{}).Where("id IN ?", deviceIDs).Count(&count).Error; err != nil {
			return err
		}
		if count != int64(len(deviceIDs)) {
			return fmt.Errorf("one or more devices were not found")
		}
	}

	if err := tx.Where("group_id = ?", groupID).Delete(&models.WindowsProfileGroup{}).Error; err != nil {
		return err
	}
	if configurationID != nil && *configurationID > 0 {
		if err := tx.Create(&models.WindowsProfileGroup{
			ProfileID: *configurationID,
			GroupID:   groupID,
		}).Error; err != nil {
			return err
		}
	}

	if err := tx.Model(&models.WindowsDevice{}).
		Where("group_id = ?", groupID).
		Update("group_id", nil).Error; err != nil {
		return err
	}

	if len(deviceIDs) > 0 {
		if err := tx.Model(&models.WindowsDevice{}).
			Where("id IN ?", deviceIDs).
			Update("group_id", groupID).Error; err != nil {
			return err
		}
	}

	return nil
}

func mapGroupAssignmentError(err error) (int, string) {
	if err == nil {
		return 0, ""
	}
	message := err.Error()
	if message == "configuration profile not found" || message == "one or more devices were not found" {
		return 400, message
	}
	return 500, "failed to save group assignments"
}
