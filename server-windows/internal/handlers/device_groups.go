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
	for _, group := range groups {
		items = append(items, models.DeviceGroupJSON{ID: group.ID, Name: group.Name})
	}

	c.JSON(http.StatusOK, models.DeviceGroupListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
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

	group := models.WindowsDeviceGroup{Name: name}
	if err := db.DB.Create(&group).Error; err != nil {
		log.Printf("[create-device-group] save failed: name=%q err=%v", name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create device group"})
		return
	}

	c.JSON(http.StatusCreated, models.DeviceGroupJSON{ID: group.ID, Name: group.Name})
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

	item := models.ToWindowsDeviceJSON(device)
	if device.GroupID != nil {
		var group models.WindowsDeviceGroup
		if err := db.DB.First(&group, *device.GroupID).Error; err == nil {
			item.GroupName = group.Name
		}
	}

	c.JSON(http.StatusOK, item)
}

func enrichDeviceJSONList(devices []models.WindowsDevice) []models.WindowsDeviceJSON {
	groupIDs := make([]uint, 0)
	for _, device := range devices {
		if device.GroupID != nil && *device.GroupID > 0 {
			groupIDs = append(groupIDs, *device.GroupID)
		}
	}
	names := lookupGroupNames(uniqueUints(groupIDs))

	items := make([]models.WindowsDeviceJSON, 0, len(devices))
	for _, device := range devices {
		item := models.ToWindowsDeviceJSON(device)
		if device.GroupID != nil {
			item.GroupName = names[*device.GroupID]
		}
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
	if device.GroupID == nil {
		return item
	}
	names := lookupGroupNames([]uint{*device.GroupID})
	item.GroupName = names[*device.GroupID]
	return item
}
