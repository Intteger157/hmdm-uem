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

// GetConfigProfileAssignments returns current group/device assignments for a profile.
func (h *WindowsHandler) GetConfigProfileAssignments(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	groupIDs, err := listAssignedGroupIDs(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load group assignments"})
		return
	}

	deviceIDs, err := listAssignedDeviceIDs(profileID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load device assignments"})
		return
	}

	c.JSON(http.StatusOK, models.ConfigProfileAssignmentsResponse{
		GroupIDs:  groupIDs,
		DeviceIDs: deviceIDs,
	})
}

// AssignConfigProfile replaces group/device assignments for a profile.
func (h *WindowsHandler) AssignConfigProfile(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	var req models.AssignConfigProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ensureConfigProfileExists(profileID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	if err := validateAssignmentTargets(req.GroupIDs, req.DeviceIDs); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "one or more assignment targets were not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate assignment targets"})
		return
	}

	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.WindowsProfileGroup{}).Error; err != nil {
			return err
		}
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.WindowsProfileDevice{}).Error; err != nil {
			return err
		}

		for _, groupID := range req.GroupIDs {
			if err := tx.Create(&models.WindowsProfileGroup{ProfileID: profileID, GroupID: groupID}).Error; err != nil {
				return err
			}
		}
		for _, deviceID := range req.DeviceIDs {
			if err := tx.Create(&models.WindowsProfileDevice{ProfileID: profileID, DeviceID: deviceID}).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		log.Printf("[assign-config-profile] save failed: profile_id=%d err=%v", profileID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save assignments"})
		return
	}

	log.Printf("[assign-config-profile] profile_id=%d groups=%d devices=%d", profileID, len(req.GroupIDs), len(req.DeviceIDs))
	c.JSON(http.StatusOK, models.ConfigProfileAssignmentsResponse{
		GroupIDs:  req.GroupIDs,
		DeviceIDs: req.DeviceIDs,
	})
}

func ensureConfigProfileExists(profileID uint) error {
	var profile models.WindowsConfigProfile
	return db.DB.Select("id").First(&profile, profileID).Error
}

func listAssignedGroupIDs(profileID uint) ([]uint, error) {
	var rows []models.WindowsProfileGroup
	if err := db.DB.Where("profile_id = ?", profileID).Order("group_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.GroupID)
	}
	return ids, nil
}

func listAssignedDeviceIDs(profileID uint) ([]uint, error) {
	var rows []models.WindowsProfileDevice
	if err := db.DB.Where("profile_id = ?", profileID).Order("device_id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.DeviceID)
	}
	return ids, nil
}

func validateAssignmentTargets(groupIDs, deviceIDs []uint) error {
	if len(groupIDs) > 0 {
		var count int64
		if err := db.DB.Model(&models.WindowsDeviceGroup{}).Where("id IN ?", groupIDs).Count(&count).Error; err != nil {
			return err
		}
		if int(count) != len(uniqueUints(groupIDs)) {
			return gorm.ErrRecordNotFound
		}
	}

	if len(deviceIDs) > 0 {
		var count int64
		if err := db.DB.Model(&models.WindowsDevice{}).Where("id IN ?", deviceIDs).Count(&count).Error; err != nil {
			return err
		}
		if int(count) != len(uniqueUints(deviceIDs)) {
			return gorm.ErrRecordNotFound
		}
	}

	return nil
}

func uniqueUints(values []uint) []uint {
	seen := make(map[uint]struct{}, len(values))
	result := make([]uint, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func deleteConfigProfileAssignments(profileID uint) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("profile_id = ?", profileID).Delete(&models.WindowsProfileGroup{}).Error; err != nil {
			return err
		}
		return tx.Where("profile_id = ?", profileID).Delete(&models.WindowsProfileDevice{}).Error
	})
}
