package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// ListDeviceGroups returns all Windows device groups.
func (h *WindowsHandler) ListDeviceGroups(c *gin.Context) {
	var groups []models.WindowsDeviceGroup
	var total int64

	if err := db.DB.Model(&models.WindowsDeviceGroup{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count device groups"})
		return
	}

	if err := db.DB.Order("name ASC, id ASC").Find(&groups).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list device groups"})
		return
	}

	items := make([]models.DeviceGroupJSON, 0, len(groups))
	groupIDs := make([]uint, 0, len(groups))
	for _, group := range groups {
		groupIDs = append(groupIDs, group.ID)
	}
	deviceCounts := countDevicesByGroup(groupIDs)
	groupProfiles := lookupGroupProfiles(groupIDs)

	for _, group := range groups {
		item := models.DeviceGroupJSON{
			ID:          group.ID,
			Name:        group.Name,
			Description: group.Description,
			DeviceCount: deviceCounts[group.ID],
		}
		if profile, ok := groupProfiles[group.ID]; ok {
			item.ConfigurationID = profile.ID
			item.ConfigurationName = profile.Name
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, models.DeviceGroupListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// GetDeviceGroup returns one Windows device group with assignments.
func (h *WindowsHandler) GetDeviceGroup(c *gin.Context) {
	groupID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var group models.WindowsDeviceGroup
	if err := db.DB.First(&group, groupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup group"})
		return
	}

	item, err := buildDeviceGroupDetailJSON(group)
	if err != nil {
		log.Printf("[get-device-group] build failed: id=%d err=%v", groupID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load device group"})
		return
	}

	c.JSON(http.StatusOK, item)
}

func saveDeviceGroupWithAssignments(
	group *models.WindowsDeviceGroup,
	configurationID *uint,
	deviceIDs []uint,
) (models.DeviceGroupJSON, int, string) {
	var result models.DeviceGroupJSON

	err := db.DB.Transaction(func(tx *gorm.DB) error {
		if group.ID == 0 {
			if err := tx.Create(group).Error; err != nil {
				return err
			}
		} else if err := tx.Save(group).Error; err != nil {
			return err
		}
		return applyGroupAssignments(tx, group.ID, configurationID, deviceIDs)
	})
	if err != nil {
		status, message := mapGroupAssignmentError(err)
		if status == 500 && err.Error() != "configuration profile not found" && err.Error() != "one or more devices were not found" {
			return result, status, "failed to save device group"
		}
		return result, status, message
	}

	item, buildErr := buildDeviceGroupDetailJSON(*group)
	if buildErr != nil {
		return result, http.StatusInternalServerError, "failed to load device group"
	}
	return item, http.StatusOK, ""
}

// CreateDeviceGroup creates a Windows device group.
func (h *WindowsHandler) CreateDeviceGroup(c *gin.Context) {
	var req models.CreateDeviceGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	group := models.WindowsDeviceGroup{
		Name:        name,
		Description: strings.TrimSpace(req.Description),
	}
	item, status, message := saveDeviceGroupWithAssignments(&group, req.ConfigurationID, req.DeviceIDs)
	if status != http.StatusOK {
		if status >= 500 {
			log.Printf("[create-device-group] save failed: name=%q err=%s", name, message)
		}
		c.JSON(status, gin.H{"error": message})
		return
	}

	c.JSON(http.StatusCreated, item)
}

// UpdateDeviceGroup updates a Windows device group.
func (h *WindowsHandler) UpdateDeviceGroup(c *gin.Context) {
	groupID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var req models.UpdateDeviceGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	var group models.WindowsDeviceGroup
	if err := db.DB.First(&group, groupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup group"})
		return
	}

	group.Name = name
	group.Description = strings.TrimSpace(req.Description)
	item, status, message := saveDeviceGroupWithAssignments(&group, req.ConfigurationID, req.DeviceIDs)
	if status != http.StatusOK {
		if status >= 500 {
			log.Printf("[update-device-group] save failed: id=%d err=%s", groupID, message)
		}
		c.JSON(status, gin.H{"error": message})
		return
	}

	c.JSON(http.StatusOK, item)
}

// DeleteDeviceGroup removes a Windows device group and clears memberships.
func (h *WindowsHandler) DeleteDeviceGroup(c *gin.Context) {
	groupID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}

	var group models.WindowsDeviceGroup
	if err := db.DB.First(&group, groupID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup group"})
		return
	}

	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.WindowsDevice{}).Where("group_id = ?", groupID).Update("group_id", nil).Error; err != nil {
			return err
		}
		if err := tx.Where("group_id = ?", groupID).Delete(&models.WindowsProfileGroup{}).Error; err != nil {
			return err
		}
		return tx.Delete(&group).Error
	}); err != nil {
		log.Printf("[delete-device-group] failed: id=%d err=%v", groupID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete device group"})
		return
	}

	c.Status(http.StatusNoContent)
}

func countDevicesByGroup(groupIDs []uint) map[uint]int64 {
	counts := make(map[uint]int64)
	if len(groupIDs) == 0 {
		return counts
	}

	var rows []struct {
		GroupID uint
		Count   int64
	}
	if err := db.DB.Model(&models.WindowsDevice{}).
		Select("group_id, COUNT(*) AS count").
		Where("group_id IN ?", groupIDs).
		Group("group_id").
		Scan(&rows).Error; err != nil {
		return counts
	}
	for _, row := range rows {
		counts[row.GroupID] = row.Count
	}
	return counts
}

// UpdateDeviceGroupMembership sets the group a Windows device belongs to.
func (h *WindowsHandler) UpdateDeviceGroupMembership(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.Param("hardwareId"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return
	}

	var req struct {
		GroupID *uint `json:"groupId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.GroupID != nil && *req.GroupID > 0 {
		var group models.WindowsDeviceGroup
		if err := db.DB.First(&group, *req.GroupID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "group not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup group"})
			return
		}
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

	if req.GroupID != nil && *req.GroupID == 0 {
		device.GroupID = nil
	} else {
		device.GroupID = req.GroupID
	}

	if err := db.DB.Save(&device).Error; err != nil {
		log.Printf("[update-device-group] save failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update device group"})
		return
	}

	item := enrichDeviceJSON(device)

	c.JSON(http.StatusOK, item)
}

func enrichDeviceJSONList(devices []models.WindowsDevice) []models.WindowsDeviceJSON {
	groupIDs := make([]uint, 0)
	deviceIDs := make([]uint, 0, len(devices))
	for _, device := range devices {
		deviceIDs = append(deviceIDs, device.ID)
		if device.GroupID != nil && *device.GroupID > 0 {
			groupIDs = append(groupIDs, *device.GroupID)
		}
	}
	groupNames := lookupGroupNames(uniqueUints(groupIDs))
	directProfiles := lookupDirectDeviceProfiles(deviceIDs)
	groupProfiles := lookupGroupProfiles(uniqueUints(groupIDs))

	items := make([]models.WindowsDeviceJSON, 0, len(devices))
	for _, device := range devices {
		item := models.ToWindowsDeviceJSON(device)
		if device.GroupID != nil {
			item.GroupName = groupNames[*device.GroupID]
		}
		applyDeviceConfiguration(&item, device.ID, device.GroupID, directProfiles, groupProfiles)
		items = append(items, item)
	}
	return items
}

func lookupGroupNames(groupIDs []uint) map[uint]string {
	names := make(map[uint]string)
	if len(groupIDs) == 0 {
		return names
	}

	var groups []models.WindowsDeviceGroup
	if err := db.DB.Where("id IN ?", groupIDs).Find(&groups).Error; err != nil {
		return names
	}
	for _, group := range groups {
		names[group.ID] = group.Name
	}
	return names
}

func enrichDeviceJSON(device models.WindowsDevice) models.WindowsDeviceJSON {
	item := models.ToWindowsDeviceJSON(device)
	if device.GroupID != nil {
		names := lookupGroupNames([]uint{*device.GroupID})
		item.GroupName = names[*device.GroupID]
	}
	directProfiles := lookupDirectDeviceProfiles([]uint{device.ID})
	var groupProfiles map[uint]resolvedProfile
	if device.GroupID != nil && *device.GroupID > 0 {
		groupProfiles = lookupGroupProfiles([]uint{*device.GroupID})
	}
	applyDeviceConfiguration(&item, device.ID, device.GroupID, directProfiles, groupProfiles)
	return item
}

type resolvedProfile struct {
	ID   uint
	Name string
}

func applyDeviceConfiguration(
	item *models.WindowsDeviceJSON,
	deviceID uint,
	groupID *uint,
	directProfiles map[uint]resolvedProfile,
	groupProfiles map[uint]resolvedProfile,
) {
	if profile, ok := directProfiles[deviceID]; ok {
		item.ConfigurationID = profile.ID
		item.ConfigurationName = profile.Name
		return
	}
	if groupID != nil {
		if profile, ok := groupProfiles[*groupID]; ok {
			item.ConfigurationID = profile.ID
			item.ConfigurationName = profile.Name
		}
	}
}

func lookupDirectDeviceProfiles(deviceIDs []uint) map[uint]resolvedProfile {
	profiles := make(map[uint]resolvedProfile)
	if len(deviceIDs) == 0 {
		return profiles
	}

	var rows []struct {
		DeviceID  uint
		ProfileID uint
		Name      string
	}
	if err := db.DB.Table("windows_profile_devices wpd").
		Select("wpd.device_id, wcp.id AS profile_id, wcp.name").
		Joins("JOIN windows_config_profiles wcp ON wcp.id = wpd.profile_id AND wcp.is_active = ?", true).
		Where("wpd.device_id IN ?", deviceIDs).
		Order("wpd.device_id ASC, wcp.id ASC").
		Scan(&rows).Error; err != nil {
		return profiles
	}

	for _, row := range rows {
		profiles[row.DeviceID] = resolvedProfile{ID: row.ProfileID, Name: row.Name}
	}
	return profiles
}

func lookupGroupProfiles(groupIDs []uint) map[uint]resolvedProfile {
	profiles := make(map[uint]resolvedProfile)
	if len(groupIDs) == 0 {
		return profiles
	}

	var rows []struct {
		GroupID   uint
		ProfileID uint
		Name      string
	}
	if err := db.DB.Table("windows_profile_groups wpg").
		Select("wpg.group_id, wcp.id AS profile_id, wcp.name").
		Joins("JOIN windows_config_profiles wcp ON wcp.id = wpg.profile_id AND wcp.is_active = ?", true).
		Where("wpg.group_id IN ?", groupIDs).
		Order("wpg.group_id ASC, wcp.id ASC").
		Scan(&rows).Error; err != nil {
		return profiles
	}

	for _, row := range rows {
		profiles[row.GroupID] = resolvedProfile{ID: row.ProfileID, Name: row.Name}
	}
	return profiles
}
