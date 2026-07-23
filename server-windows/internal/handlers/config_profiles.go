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

// ListConfigProfiles returns all Windows configuration profiles.
func (h *WindowsHandler) ListConfigProfiles(c *gin.Context) {
	var profiles []models.WindowsConfigProfile
	var total int64

	if err := db.DB.Model(&models.WindowsConfigProfile{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count configuration profiles"})
		return
	}

	if err := db.DB.Order("updated_at DESC, id DESC").Find(&profiles).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list configuration profiles"})
		return
	}

	items := make([]models.ConfigProfileJSON, 0, len(profiles))
	for _, profile := range profiles {
		item, err := models.ToConfigProfileJSON(profile)
		if err != nil {
			log.Printf("[list-config-profiles] decode payload failed: id=%d err=%v", profile.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode configuration profile"})
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, models.ConfigProfileListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// GetConfigProfile returns one Windows configuration profile.
func (h *WindowsHandler) GetConfigProfile(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	var profile models.WindowsConfigProfile
	if err := db.DB.First(&profile, profileID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	item, err := models.ToConfigProfileJSON(profile)
	if err != nil {
		log.Printf("[get-config-profile] decode payload failed: id=%d err=%v", profile.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode configuration profile"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// CreateConfigProfile creates a Windows configuration profile.
func (h *WindowsHandler) CreateConfigProfile(c *gin.Context) {
	var req models.UpsertConfigProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	payload, err := models.EncodeConfigProfilePayload(req.Payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	profile := models.WindowsConfigProfile{
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		Payload:     payload,
		IsActive:    req.IsActive,
	}

	if err := db.DB.Create(&profile).Error; err != nil {
		log.Printf("[create-config-profile] save failed: name=%q err=%v", name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create configuration profile"})
		return
	}

	item, err := models.ToConfigProfileJSON(profile)
	if err != nil {
		log.Printf("[create-config-profile] decode payload failed: id=%d err=%v", profile.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode configuration profile"})
		return
	}

	log.Printf("[create-config-profile] created id=%d name=%q", profile.ID, profile.Name)
	c.JSON(http.StatusCreated, item)
}

// UpdateConfigProfile updates a Windows configuration profile.
func (h *WindowsHandler) UpdateConfigProfile(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	var req models.UpsertConfigProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	payload, err := models.EncodeConfigProfilePayload(req.Payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile models.WindowsConfigProfile
	if err := db.DB.First(&profile, profileID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup configuration profile"})
		return
	}

	profile.Name = name
	profile.Description = strings.TrimSpace(req.Description)
	profile.Payload = payload
	profile.IsActive = req.IsActive

	if err := db.DB.Save(&profile).Error; err != nil {
		log.Printf("[update-config-profile] save failed: id=%d err=%v", profileID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update configuration profile"})
		return
	}

	item, err := models.ToConfigProfileJSON(profile)
	if err != nil {
		log.Printf("[update-config-profile] decode payload failed: id=%d err=%v", profile.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to decode configuration profile"})
		return
	}

	log.Printf("[update-config-profile] updated id=%d name=%q", profile.ID, profile.Name)
	c.JSON(http.StatusOK, item)
}

// DeleteConfigProfile removes a Windows configuration profile.
func (h *WindowsHandler) DeleteConfigProfile(c *gin.Context) {
	profileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile id"})
		return
	}

	result := db.DB.Delete(&models.WindowsConfigProfile{}, profileID)
	if result.Error != nil {
		log.Printf("[delete-config-profile] delete failed: id=%d err=%v", profileID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete configuration profile"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "configuration profile not found"})
		return
	}

	if err := deleteConfigProfileAssignments(profileID); err != nil {
		log.Printf("[delete-config-profile] cleanup assignments failed: id=%d err=%v", profileID, err)
	}

	log.Printf("[delete-config-profile] deleted id=%d", profileID)
	c.Status(http.StatusNoContent)
}
