package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/config"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const enrollmentProvisioningSettingsID uint = 1

// GetEnrollmentProvisioning returns Autopilot bootstrap provisioning settings.
func (h *WindowsHandler) GetEnrollmentProvisioning(c *gin.Context) {
	settings, err := getOrCreateEnrollmentProvisioningSettings()
	if err != nil {
		log.Printf("[enrollment-provisioning] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment provisioning settings"})
		return
	}

	c.JSON(http.StatusOK, toEnrollmentProvisioningResponse(settings))
}

// UpdateEnrollmentProvisioning saves Autopilot bootstrap provisioning settings.
func (h *WindowsHandler) UpdateEnrollmentProvisioning(c *gin.Context) {
	var req models.UpdateEnrollmentProvisioningRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.AdminUsername = strings.TrimSpace(req.AdminUsername)
	req.AdminPassword = strings.TrimSpace(req.AdminPassword)

	if req.CreateLocalAdmin {
		if req.AdminUsername == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin username is required when local admin provisioning is enabled"})
			return
		}
		if req.AdminPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin password is required when local admin provisioning is enabled"})
			return
		}
	}

	settings, err := getOrCreateEnrollmentProvisioningSettings()
	if err != nil {
		log.Printf("[enrollment-provisioning] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment provisioning settings"})
		return
	}

	settings.CreateLocalAdmin = req.CreateLocalAdmin
	settings.AdminUsername = req.AdminUsername
	settings.AdminPassword = req.AdminPassword
	settings.UpdatedAt = time.Now().UTC()

	if err := db.DB.Save(settings).Error; err != nil {
		log.Printf("[enrollment-provisioning] save failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save enrollment provisioning settings"})
		return
	}

	log.Printf("[enrollment-provisioning] updated create_local_admin=%t admin_user=%q", settings.CreateLocalAdmin, settings.AdminUsername)
	c.JSON(http.StatusOK, toEnrollmentProvisioningResponse(settings))
}

func getOrCreateEnrollmentProvisioningSettings() (*models.WindowsEnrollmentProvisioningSettings, error) {
	var settings models.WindowsEnrollmentProvisioningSettings
	err := db.DB.First(&settings, enrollmentProvisioningSettingsID).Error
	if err == nil {
		return &settings, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("lookup enrollment provisioning settings: %w", err)
	}

	defaultUser, defaultPass := config.AutopilotAdminDefaults()
	settings = models.WindowsEnrollmentProvisioningSettings{
		ID:               enrollmentProvisioningSettingsID,
		CreateLocalAdmin: false,
		AdminUsername:    defaultUser,
		AdminPassword:    defaultPass,
		UpdatedAt:        time.Now().UTC(),
	}
	if err := db.DB.Create(&settings).Error; err != nil {
		return nil, fmt.Errorf("create enrollment provisioning settings: %w", err)
	}

	return &settings, nil
}

func toEnrollmentProvisioningResponse(settings *models.WindowsEnrollmentProvisioningSettings) models.EnrollmentProvisioningResponse {
	return models.EnrollmentProvisioningResponse{
		CreateLocalAdmin: settings.CreateLocalAdmin,
		AdminUsername:    settings.AdminUsername,
		AdminPassword:    settings.AdminPassword,
	}
}

func loadActiveEnrollmentProvisioning() (*models.WindowsEnrollmentProvisioningSettings, error) {
	settings, err := getOrCreateEnrollmentProvisioningSettings()
	if err != nil {
		return nil, err
	}
	if !settings.CreateLocalAdmin {
		return nil, nil
	}
	if strings.TrimSpace(settings.AdminUsername) == "" || strings.TrimSpace(settings.AdminPassword) == "" {
		return nil, nil
	}
	return settings, nil
}
