package handlers

import (
	"errors"
	"log"

	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

func applyExclusiveDefaultProfile(profileID uint, isDefault bool) error {
	return applyExclusiveProfileFlag("is_default", profileID, isDefault)
}

// applyExclusivePostEnrollmentDefaultProfile keeps at most one profile flagged as
// the target for devices that finished their initial provisioning phase.
func applyExclusivePostEnrollmentDefaultProfile(profileID uint, isPostEnrollmentDefault bool) error {
	return applyExclusiveProfileFlag("is_post_enrollment_default", profileID, isPostEnrollmentDefault)
}

func applyExclusiveProfileFlag(column string, profileID uint, enabled bool) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if enabled {
			if err := tx.Model(&models.WindowsConfigProfile{}).
				Where("id <> ?", profileID).
				Update(column, false).Error; err != nil {
				return err
			}
		}
		return tx.Model(&models.WindowsConfigProfile{}).
			Where("id = ?", profileID).
			Update(column, enabled).Error
	})
}

func findDefaultConfigProfile() (models.WindowsConfigProfile, bool, error) {
	var profile models.WindowsConfigProfile
	err := db.DB.Where("is_default = ?", true).Order("id ASC").First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.WindowsConfigProfile{}, false, nil
	}
	if err != nil {
		return models.WindowsConfigProfile{}, false, err
	}
	return profile, true, nil
}

func findPostEnrollmentDefaultConfigProfile() (models.WindowsConfigProfile, bool, error) {
	var profile models.WindowsConfigProfile
	err := db.DB.Where("is_post_enrollment_default = ?", true).Order("id ASC").First(&profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return models.WindowsConfigProfile{}, false, nil
	}
	if err != nil {
		return models.WindowsConfigProfile{}, false, err
	}
	return profile, true, nil
}

func assignDefaultProfileToDevice(deviceID uint) error {
	profile, ok, err := findDefaultConfigProfile()
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	if !profile.IsActive {
		log.Printf("[default-profile] skip device_id=%d profile_id=%d is not active", deviceID, profile.ID)
		return nil
	}

	var existing models.WindowsProfileDevice
	err = db.DB.Where("device_id = ? AND profile_id = ?", deviceID, profile.ID).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if err := db.DB.Create(&models.WindowsProfileDevice{
		ProfileID: profile.ID,
		DeviceID:  deviceID,
	}).Error; err != nil {
		return err
	}

	log.Printf("[default-profile] assigned profile_id=%d name=%q to device_id=%d", profile.ID, profile.Name, deviceID)
	return nil
}
