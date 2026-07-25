package handlers

import (
	"log"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

func listDevicesWithLatestAppAssignment(appID uint) ([]uint, error) {
	deviceIDs := make(map[uint]struct{})

	var latestProfileLinks []models.ProfileApp
	if err := db.DB.Where("app_id = ? AND version_id IS NULL", appID).Find(&latestProfileLinks).Error; err != nil {
		return nil, err
	}
	for _, link := range latestProfileLinks {
		profileDeviceIDs, err := listProfileAssignedDeviceIDs(link.ProfileID)
		if err != nil {
			return nil, err
		}
		for _, deviceID := range profileDeviceIDs {
			deviceIDs[deviceID] = struct{}{}
		}
	}

	var directLinks []models.WindowsDeviceApp
	if err := db.DB.Where("app_id = ? AND version_id IS NULL", appID).Find(&directLinks).Error; err != nil {
		return nil, err
	}
	for _, link := range directLinks {
		if link.DeviceID > 0 {
			deviceIDs[link.DeviceID] = struct{}{}
		}
	}

	ids := make([]uint, 0, len(deviceIDs))
	for deviceID := range deviceIDs {
		ids = append(ids, deviceID)
	}
	return ids, nil
}

func listProfileAssignedDeviceIDs(profileID uint) ([]uint, error) {
	deviceIDs := make(map[uint]struct{})

	var directLinks []models.WindowsProfileDevice
	if err := db.DB.Where("profile_id = ?", profileID).Find(&directLinks).Error; err != nil {
		return nil, err
	}
	for _, link := range directLinks {
		if link.DeviceID > 0 {
			deviceIDs[link.DeviceID] = struct{}{}
		}
	}

	var groupLinks []models.WindowsProfileGroup
	if err := db.DB.Where("profile_id = ?", profileID).Find(&groupLinks).Error; err != nil {
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
            if err := db.DB.Where("group_id IN ?", groupIDs).Find(&groupedDevices).Error; err != nil {
                return nil, err
            }
			for _, device := range groupedDevices {
				if device.ID > 0 {
					deviceIDs[device.ID] = struct{}{}
				}
			}
		}
	}

	ids := make([]uint, 0, len(deviceIDs))
	for deviceID := range deviceIDs {
		ids = append(ids, deviceID)
	}
	return ids, nil
}

func requeueLatestAppVersionDeployments(appID uint, version models.ApplicationVersion) error {
	deviceIDs, err := listDevicesWithLatestAppAssignment(appID)
	if err != nil {
		return err
	}
	if len(deviceIDs) == 0 {
		return nil
	}

	catalogTime := version.UpdatedAt.UTC()
	if catalogTime.IsZero() {
		catalogTime = version.UploadedAt.UTC()
	}

	var statuses []models.DeviceAppStatus
	if err := db.DB.Where(
		"device_id IN ? AND app_id = ? AND status = ?",
		deviceIDs,
		appID,
		models.AppStatusSuccess,
	).Find(&statuses).Error; err != nil {
		return err
	}

	requeued := 0
	for _, status := range statuses {
		if status.AttemptedCatalogUpdatedAt != nil && !catalogTime.After(status.AttemptedCatalogUpdatedAt.UTC()) {
			continue
		}
		if err := upsertDeviceAppStatus(status.DeviceID, appID, models.AppStatusPending, "", nil); err != nil {
			return err
		}
		requeued++
	}

	if requeued > 0 {
		log.Printf(
			"[requeue-app-version] app_id=%d version_id=%d version=%q requeued_devices=%d",
			appID,
			version.ID,
			version.Version,
			requeued,
		)
	}
	return nil
}
