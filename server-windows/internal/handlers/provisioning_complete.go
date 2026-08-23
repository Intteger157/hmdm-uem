package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// ReportProvisioningComplete moves a device to the post-enrollment default profile
// once its agent reports that the initial provisioning phase is fully applied.
func (h *WindowsHandler) ReportProvisioningComplete(c *gin.Context) {
	deviceID := stringsTrimDeviceHeader(c)
	if deviceID == "" {
		return
	}

	hardwareID := stringsTrimHardwareID(c)
	if hardwareID == "" {
		return
	}
	if hardwareID != deviceID {
		c.JSON(http.StatusForbidden, gin.H{"error": "hardware id mismatch"})
		return
	}

	var device models.WindowsDevice
	if err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}

	profile, ok, err := findPostEnrollmentDefaultConfigProfile()
	if err != nil {
		log.Printf("[provisioning-complete] lookup failed: device_id=%d err=%v", device.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup post-enrollment configuration"})
		return
	}
	if !ok || !profile.IsActive {
		log.Printf("[provisioning-complete] no active post-enrollment configuration: device_id=%d", device.ID)
		c.JSON(http.StatusOK, models.DeviceProvisioningCompleteResponse{Changed: false})
		return
	}

	changed, err := assignPostEnrollmentProfileToDevice(device.ID, profile.ID)
	if err != nil {
		log.Printf("[provisioning-complete] assignment failed: device_id=%d profile_id=%d err=%v", device.ID, profile.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign post-enrollment configuration"})
		return
	}

	if changed {
		log.Printf(
			"[provisioning-complete] device_id=%d moved to profile_id=%d name=%q",
			device.ID,
			profile.ID,
			profile.Name,
		)
	}

	c.JSON(http.StatusOK, models.DeviceProvisioningCompleteResponse{
		Changed:           changed,
		ConfigurationID:   profile.ID,
		ConfigurationName: profile.Name,
	})
}

// assignPostEnrollmentProfileToDevice replaces the device's direct profile links with
// the post-enrollment profile. Group assignments stay untouched because they are an
// explicit admin decision rather than part of the enrollment handover.
func assignPostEnrollmentProfileToDevice(deviceID, profileID uint) (bool, error) {
	currentProfileIDs, err := listDeviceDirectProfileIDs(deviceID)
	if err != nil {
		return false, err
	}
	if !needsPostEnrollmentSwitch(currentProfileIDs, profileID) {
		return false, nil
	}

	err = db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("device_id = ?", deviceID).Delete(&models.WindowsProfileDevice{}).Error; err != nil {
			return err
		}
		return tx.Create(&models.WindowsProfileDevice{ProfileID: profileID, DeviceID: deviceID}).Error
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

// needsPostEnrollmentSwitch reports whether the direct assignment differs from the
// post-enrollment profile, which keeps a repeated agent signal a no-op.
func needsPostEnrollmentSwitch(currentProfileIDs []uint, targetProfileID uint) bool {
	if targetProfileID == 0 {
		return false
	}
	if len(currentProfileIDs) != 1 {
		return true
	}
	return currentProfileIDs[0] != targetProfileID
}

func listDeviceDirectProfileIDs(deviceID uint) ([]uint, error) {
	var rows []models.WindowsProfileDevice
	if err := db.DB.Where("device_id = ?", deviceID).Order("profile_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ProfileID)
	}
	return ids, nil
}
