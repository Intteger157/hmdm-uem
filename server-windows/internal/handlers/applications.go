package handlers

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// ListSoftwareApps returns catalog applications with their versions.
func (h *WindowsHandler) ListSoftwareApps(c *gin.Context) {
	var apps []models.Application
	var total int64

	if err := db.DB.Model(&models.Application{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count applications"})
		return
	}

	if err := db.DB.Order("created_at DESC, id DESC").Find(&apps).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list applications"})
		return
	}

	appIDs := make([]uint, 0, len(apps))
	for _, app := range apps {
		appIDs = append(appIDs, app.ID)
	}
	versionsByAppID, err := loadVersionsByAppIDs(appIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load application versions"})
		return
	}

	items := make([]models.ApplicationJSON, 0, len(apps))
	for _, app := range apps {
		versions := versionsByAppID[app.ID]
		item := models.ToApplicationJSON(app, versions)
		for i := range item.Versions {
			item.Versions[i].DownloadURL = normalizeDownloadURL(item.Versions[i].DownloadURL)
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, models.ApplicationListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// GetSoftwareApp returns one catalog application with versions.
func (h *WindowsHandler) GetSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	var app models.Application
	if err := db.DB.First(&app, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
		return
	}

	versions, err := loadApplicationVersions(appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load application versions"})
		return
	}

	item := models.ToApplicationJSON(app, versions)
	for i := range item.Versions {
		item.Versions[i].DownloadURL = normalizeDownloadURL(item.Versions[i].DownloadURL)
	}
	c.JSON(http.StatusOK, item)
}

// UpdateSoftwareApp updates application metadata.
func (h *WindowsHandler) UpdateSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	var req models.UpdateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var app models.Application
	if err := db.DB.First(&app, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	var existing models.Application
	if err := db.DB.Where("LOWER(name) = LOWER(?) AND id <> ?", name, appID).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "application with this name already exists"})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate application name"})
		return
	}

	app.Name = name
	app.Publisher = strings.TrimSpace(req.Publisher)
	app.Description = strings.TrimSpace(req.Description)
	if err := db.DB.Save(&app).Error; err != nil {
		log.Printf("[update-application] save failed: id=%d err=%v", appID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update application"})
		return
	}

	versions, err := loadApplicationVersions(appID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load application versions"})
		return
	}

	log.Printf("[update-application] updated id=%d name=%q", app.ID, app.Name)
	item := models.ToApplicationJSON(app, versions)
	c.JSON(http.StatusOK, item)
}

// DeleteSoftwareApp removes an application and all versions.
func (h *WindowsHandler) DeleteSoftwareApp(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	result := db.DB.Delete(&models.Application{}, appID)
	if result.Error != nil {
		log.Printf("[delete-application] delete failed: id=%d err=%v", appID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete application"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
		return
	}

	if err := db.DB.Where("app_id = ?", appID).Delete(&models.ApplicationVersion{}).Error; err != nil {
		log.Printf("[delete-application] cleanup versions failed: id=%d err=%v", appID, err)
	}
	if err := db.DB.Where("app_id = ?", appID).Delete(&models.ProfileApp{}).Error; err != nil {
		log.Printf("[delete-application] cleanup profile_apps failed: id=%d err=%v", appID, err)
	}
	if err := db.DB.Where("app_id = ?", appID).Delete(&models.WindowsDeviceApp{}).Error; err != nil {
		log.Printf("[delete-application] cleanup windows_device_apps failed: id=%d err=%v", appID, err)
	}
	if err := db.DB.Where("app_id = ?", appID).Delete(&models.DeviceAppStatus{}).Error; err != nil {
		log.Printf("[delete-application] cleanup device_app_statuses failed: id=%d err=%v", appID, err)
	}

	log.Printf("[delete-application] deleted id=%d", appID)
	c.Status(http.StatusNoContent)
}

// CreateSoftwareApp creates an application with its first version (URL/winget/manual).
func (h *WindowsHandler) CreateSoftwareApp(c *gin.Context) {
	var req models.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	if _, err := findApplicationByName(name); err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "application with this name already exists"})
		return
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate application name"})
		return
	}

	app := models.Application{
		Name:        name,
		Publisher:   strings.TrimSpace(req.Publisher),
		Description: strings.TrimSpace(req.Description),
		CreatedAt:   time.Now(),
	}
	version := models.ApplicationVersion{IsActive: true}
	if err := applyVersionUpsertRequest(&version, req.CreateApplicationVersionRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	version.UploadedAt = now
	version.UpdatedAt = now

	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&app).Error; err != nil {
			return err
		}
		version.AppID = app.ID
		return tx.Create(&version).Error
	}); err != nil {
		log.Printf("[create-application] save failed: name=%q err=%v", app.Name, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create application"})
		return
	}

	log.Printf("[create-application] created id=%d name=%q version_id=%d", app.ID, app.Name, version.ID)
	item := models.ToApplicationJSON(app, []models.ApplicationVersion{version})
	item.Versions[0].DownloadURL = normalizeDownloadURL(item.Versions[0].DownloadURL)
	c.JSON(http.StatusCreated, item)
}

// CreateApplicationVersion adds a version to an existing application.
func (h *WindowsHandler) CreateApplicationVersion(c *gin.Context) {
	appID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid app id"})
		return
	}

	var req models.CreateApplicationVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := db.DB.First(&models.Application{}, appID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
		return
	}

	version := models.ApplicationVersion{AppID: appID, IsActive: true}
	if err := applyVersionUpsertRequest(&version, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	version.UploadedAt = now
	version.UpdatedAt = now

	if err := db.DB.Create(&version).Error; err != nil {
		log.Printf("[create-application-version] save failed: app_id=%d err=%v", appID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create application version"})
		return
	}

	item := models.ToApplicationVersionJSON(version)
	item.DownloadURL = normalizeDownloadURL(item.DownloadURL)
	c.JSON(http.StatusCreated, item)
}

func parseOptionalAppID(raw string) (uint, bool) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, true
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil || parsed == 0 {
		return 0, false
	}
	return uint(parsed), true
}
