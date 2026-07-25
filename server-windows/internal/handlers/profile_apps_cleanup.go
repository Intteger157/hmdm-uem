package handlers

import (
	"strings"
	"time"

	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func listAssignedAppIDsTx(tx *gorm.DB, profileID uint) ([]uint, error) {
	var rows []models.ProfileApp
	if err := tx.Where("profile_id = ?", profileID).Order("app_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.AppID)
	}
	return ids, nil
}

func removedAppIDs(previous, next []uint) []uint {
	nextSet := make(map[uint]struct{}, len(next))
	for _, appID := range next {
		if appID > 0 {
			nextSet[appID] = struct{}{}
		}
	}

	removed := make([]uint, 0)
	seen := make(map[uint]struct{})
	for _, appID := range previous {
		if appID == 0 {
			continue
		}
		if _, ok := nextSet[appID]; ok {
			continue
		}
		if _, ok := seen[appID]; ok {
			continue
		}
		seen[appID] = struct{}{}
		removed = append(removed, appID)
	}
	return removed
}

func listProfileAssignedHardwareIDs(tx *gorm.DB, profileID uint) ([]string, error) {
	deviceIDs := make(map[uint]struct{})

	var directLinks []models.WindowsProfileDevice
	if err := tx.Where("profile_id = ?", profileID).Find(&directLinks).Error; err != nil {
		return nil, err
	}
	for _, link := range directLinks {
		if link.DeviceID > 0 {
			deviceIDs[link.DeviceID] = struct{}{}
		}
	}

	var groupLinks []models.WindowsProfileGroup
	if err := tx.Where("profile_id = ?", profileID).Find(&groupLinks).Error; err != nil {
		return nil, err
	}
	if len(groupLinks) > 0 {
		groupIDs := make([]uint, 0, len(groupLinks))
		for _, link := range groupLinks {
			if link.GroupID > 0 {
				groupIDs = append(groupIDs, link.GroupID)
			}
		}
		if len(groupIDs) > 0 {
			var groupedDevices []models.WindowsDevice
			if err := tx.Where("group_id IN ?", groupIDs).Find(&groupedDevices).Error; err != nil {
				return nil, err
			}
			for _, device := range groupedDevices {
				if device.ID > 0 {
					deviceIDs[device.ID] = struct{}{}
				}
			}
		}
	}

	if len(deviceIDs) == 0 {
		return nil, nil
	}

	ids := make([]uint, 0, len(deviceIDs))
	for deviceID := range deviceIDs {
		ids = append(ids, deviceID)
	}

	var devices []models.WindowsDevice
	if err := tx.Where("id IN ?", ids).Find(&devices).Error; err != nil {
		return nil, err
	}

	hardwareIDs := make([]string, 0, len(devices))
	seen := make(map[string]struct{}, len(devices))
	for _, device := range devices {
		hardwareID := strings.TrimSpace(device.HardwareID)
		if hardwareID == "" {
			continue
		}
		if _, ok := seen[hardwareID]; ok {
			continue
		}
		seen[hardwareID] = struct{}{}
		hardwareIDs = append(hardwareIDs, hardwareID)
	}
	return hardwareIDs, nil
}

func cancelPendingAppInstallsForRemovedApps(tx *gorm.DB, profileID uint, removedAppIDs []uint) error {
	if len(removedAppIDs) == 0 {
		return nil
	}

	hardwareIDs, err := listProfileAssignedHardwareIDs(tx, profileID)
	if err != nil {
		return err
	}
	if len(hardwareIDs) == 0 {
		return nil
	}

	removedSet := make(map[uint]struct{}, len(removedAppIDs))
	for _, appID := range removedAppIDs {
		removedSet[appID] = struct{}{}
	}

	if err := cancelPendingAppInstallCommandLogs(tx, hardwareIDs, removedSet); err != nil {
		return err
	}
	return cancelDeviceAppStatuses(tx, hardwareIDs, removedAppIDs)
}

func cancelPendingAppInstallCommandLogs(tx *gorm.DB, hardwareIDs []string, removedAppIDs map[uint]struct{}) error {
	var entries []models.DeviceCommandLog
	if err := tx.Where(
		"device_id IN ? AND command_name = ? AND status IN ?",
		hardwareIDs,
		models.CommandNameAppInstall,
		[]string{
			models.CommandLogStatusPending,
			models.AppInstallStatusDownloading,
			models.AppInstallStatusInstalling,
			models.AppInstallStepAppCheck,
			models.AppInstallStepAppDownload,
			models.AppInstallStepAppUnblock,
			models.AppInstallStepAppInstall,
			models.AppInstallStepAppResult,
		},
	).Find(&entries).Error; err != nil {
		return err
	}

	now := time.Now()
	for _, entry := range entries {
		appID, err := parseAppInstallPayloadAppID(entry.Payload)
		if err != nil {
			continue
		}
		if _, ok := removedAppIDs[appID]; !ok {
			continue
		}

		entry.Status = models.CommandLogStatusCanceled
		if entry.Output == "" {
			entry.Output = models.AppInstallCanceledMessage
		}
		entry.ExecutedAt = &now
		if err := tx.Save(&entry).Error; err != nil {
			return err
		}
	}
	return nil
}

func cancelDeviceAppStatuses(tx *gorm.DB, hardwareIDs []string, removedAppIDs []uint) error {
	var devices []models.WindowsDevice
	if err := tx.Where("hardware_id IN ?", hardwareIDs).Find(&devices).Error; err != nil {
		return err
	}
	if len(devices) == 0 {
		return nil
	}

	deviceIDs := make([]uint, 0, len(devices))
	for _, device := range devices {
		deviceIDs = append(deviceIDs, device.ID)
	}

	var statuses []models.DeviceAppStatus
	if err := tx.Where(
		"device_id IN ? AND app_id IN ? AND status IN ?",
		deviceIDs,
		removedAppIDs,
		[]string{
			models.AppStatusPending,
			models.AppStatusDownloading,
			models.AppStatusInstalling,
		},
	).Find(&statuses).Error; err != nil {
		return err
	}

	for _, status := range statuses {
		status.Status = models.AppStatusCanceled
		status.ErrorMessage = models.AppInstallCanceledMessage
		if err := tx.Save(&status).Error; err != nil {
			return err
		}
	}
	return nil
}
