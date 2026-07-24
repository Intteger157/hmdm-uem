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

const enrollmentSettingsID uint = 1

// GetEnrollmentSecurity returns Autopilot enrollment security settings.
func (h *WindowsHandler) GetEnrollmentSecurity(c *gin.Context) {
	settings, err := getOrCreateEnrollmentSettings()
	if err != nil {
		log.Printf("[enrollment-security] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment security settings"})
		return
	}

	c.JSON(http.StatusOK, toEnrollmentSecurityResponse(settings))
}

// UpdateEnrollmentSecurity saves Autopilot enrollment security settings.
func (h *WindowsHandler) UpdateEnrollmentSecurity(c *gin.Context) {
	var req models.UpdateEnrollmentSecurityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	req.EnrollmentMode = normalizeEnrollmentMode(req.EnrollmentMode)
	req.EnrollmentSecret = strings.TrimSpace(req.EnrollmentSecret)
	if req.EnrollmentSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "enrollment secret is required"})
		return
	}

	settings, err := getOrCreateEnrollmentSettings()
	if err != nil {
		log.Printf("[enrollment-security] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment security settings"})
		return
	}

	settings.EnrollmentMode = req.EnrollmentMode
	settings.EnrollmentSecret = req.EnrollmentSecret
	settings.UpdatedAt = time.Now().UTC()

	if err := db.DB.Model(&models.WindowsEnrollmentProvisioningSettings{}).
		Where("id = ?", settings.ID).
		Updates(map[string]interface{}{
			"enrollment_mode":   settings.EnrollmentMode,
			"enrollment_secret": settings.EnrollmentSecret,
			"updated_at":        settings.UpdatedAt,
		}).Error; err != nil {
		log.Printf("[enrollment-security] save failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save enrollment security settings"})
		return
	}

	log.Printf("[enrollment-security] updated mode=%q", settings.EnrollmentMode)
	c.JSON(http.StatusOK, toEnrollmentSecurityResponse(settings))
}

func toEnrollmentSecurityResponse(settings *models.WindowsEnrollmentProvisioningSettings) models.EnrollmentSecurityResponse {
	return models.EnrollmentSecurityResponse{
		EnrollmentMode:   settings.EnrollmentMode,
		EnrollmentSecret: settings.EnrollmentSecret,
	}
}

func getOrCreateEnrollmentSettings() (*models.WindowsEnrollmentProvisioningSettings, error) {
	var settings models.WindowsEnrollmentProvisioningSettings
	err := db.DB.First(&settings, enrollmentSettingsID).Error
	if err == nil {
		updated := false
		if settings.EnrollmentMode == "" {
			settings.EnrollmentMode = models.EnrollmentModeToken
			updated = true
		}
		if strings.TrimSpace(settings.EnrollmentSecret) == "" {
			secret := config.EnrollmentSecretDefault()
			if secret == "" {
				generated, genErr := generateEnrollmentSecret()
				if genErr != nil {
					return nil, genErr
				}
				secret = generated
			}
			settings.EnrollmentSecret = secret
			updated = true
		}
		if updated {
			settings.UpdatedAt = time.Now().UTC()
			if saveErr := db.DB.Model(&models.WindowsEnrollmentProvisioningSettings{}).
				Where("id = ?", settings.ID).
				Updates(map[string]interface{}{
					"enrollment_mode":   settings.EnrollmentMode,
					"enrollment_secret": settings.EnrollmentSecret,
					"updated_at":        settings.UpdatedAt,
				}).Error; saveErr != nil {
				return nil, fmt.Errorf("update enrollment settings defaults: %w", saveErr)
			}
		}
		return &settings, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("lookup enrollment settings: %w", err)
	}

	defaultUser, defaultPass := config.AutopilotAdminDefaults()
	secret := config.EnrollmentSecretDefault()
	if secret == "" {
		generated, genErr := generateEnrollmentSecret()
		if genErr != nil {
			return nil, genErr
		}
		secret = generated
	}

	settings = models.WindowsEnrollmentProvisioningSettings{
		ID:               enrollmentSettingsID,
		CreateLocalAdmin: false,
		AdminUsername:    defaultUser,
		AdminPassword:    defaultPass,
		EnrollmentMode:   models.EnrollmentModeToken,
		EnrollmentSecret: secret,
		UpdatedAt:        time.Now().UTC(),
	}
	if err := db.DB.Create(&settings).Error; err != nil {
		return nil, fmt.Errorf("create enrollment settings: %w", err)
	}

	return &settings, nil
}

func loadEnrollmentSecurityForBootstrap() (*models.WindowsEnrollmentProvisioningSettings, error) {
	settings, err := getOrCreateEnrollmentSettings()
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(settings.EnrollmentSecret) == "" {
		return nil, fmt.Errorf("enrollment secret is not configured")
	}
	if settings.EnrollmentMode == "" {
		settings.EnrollmentMode = models.EnrollmentModeToken
	}
	return settings, nil
}
