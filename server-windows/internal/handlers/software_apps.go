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

// ListSoftwareApps returns all catalog apps.
func (h *WindowsHandler) ListSoftwareApps(c *gin.Context) {
	var apps []models.SoftwareApp
	var total int64

	if err := db.DB.Model(&models.SoftwareApp{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count software apps"})
		return
	}

	if err := db.DB.Order("updated_at DESC, id DESC").Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list software apps"})
		return
	}

	items := make([]models.SoftwareAppJSON, 0, len(apps))
	for _, app := range apps {
		items = append(items, models.ToSoftwareAppJSON(app))
	}

	c.JSON(http.StatusOK, models.SoftwareAppListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// GetSoftwareApp returns one catalog app.
func (h *WindowsHandler) GetSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	var app models.SoftwareApp
	if err := db.DB.First(&app, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "software app not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup software app"})
		return
	}

	c.JSON(http.StatusOK, models.ToSoftwareAppJSON(app))
}

// CreateSoftwareApp creates a catalog app.
func (h *WindowsHandler) CreateSoftwareApp(c *gin.Context) {
	var req models.UpsertSoftwareAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app := models.SoftwareApp{}
	if err := applyUpsertRequest(&app, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.DB.Create(&app).Error; err != nil {
		log.Printf("[create-software-app] save failed: name=%q err=%v", app.Name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create software app"})
		return
	}

	log.Printf("[create-software-app] created id=%d name=%q type=%q", app.ID, app.Name, app.AppType)
	c.JSON(http.StatusCreated, models.ToSoftwareAppJSON(app))
}

// UpdateSoftwareApp updates a catalog app.
func (h *WindowsHandler) UpdateSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	var req models.UpsertSoftwareAppRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var app models.SoftwareApp
	if err := db.DB.First(&app, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "software app not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup software app"})
		return
	}

	if err := applyUpsertRequest(&app, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.DB.Save(&app).Error; err != nil {
		log.Printf("[update-software-app] save failed: id=%d err=%v", appID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update software app"})
		return
	}

	log.Printf("[update-software-app] updated id=%d name=%q", app.ID, app.Name)
	c.JSON(http.StatusOK, models.ToSoftwareAppJSON(app))
}

// DeleteSoftwareApp removes a catalog app.
func (h *WindowsHandler) DeleteSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	result := db.DB.Delete(&models.SoftwareApp{}, appID)
	if result.Error != nil {
		log.Printf("[delete-software-app] delete failed: id=%d err=%v", appID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete software app"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "software app not found"})
		return
	}

	if err := db.DB.Where("app_id = ?", appID).Delete(&models.ProfileApp{}).Error; err != nil {
		log.Printf("[delete-software-app] cleanup profile_apps failed: id=%d err=%v", appID, err)
	}
	if err := db.DB.Where("app_id = ?", appID).Delete(&models.WindowsDeviceApp{}).Error; err != nil {
		log.Printf("[delete-software-app] cleanup windows_device_apps failed: id=%d err=%v", appID, err)
	}
	if err := db.DB.Where("app_id = ?", appID).Delete(&models.DeviceAppStatus{}).Error; err != nil {
		log.Printf("[delete-software-app] cleanup device_app_statuses failed: id=%d err=%v", appID, err)
	}

	log.Printf("[delete-software-app] deleted id=%d", appID)
	c.Status(http.StatusNoContent)
}
