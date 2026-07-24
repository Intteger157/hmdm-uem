package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

// GetEnrollmentProvisioning returns Autopilot bootstrap provisioning settings.
func (h *WindowsHandler) GetEnrollmentProvisioning(c *gin.Context) {
	settings, err := getOrCreateEnrollmentSettings()
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
		log.Printf("[enrollment-provisioning] invalid body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	provisioningEnabled := req.ResolvedProvisioningEnabled()
	req.AdminUsername = strings.TrimSpace(req.AdminUsername)
	req.AdminPassword = strings.TrimSpace(req.AdminPassword)

	if provisioningEnabled {
		if req.AdminUsername == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin username is required when local admin provisioning is enabled"})
			return
		}
		if req.AdminPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "admin password is required when local admin provisioning is enabled"})
			return
		}
	}

	if _, err := getOrCreateEnrollmentSettings(); err != nil {
		log.Printf("[enrollment-provisioning] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment provisioning settings"})
		return
	}

	if err := saveEnrollmentProvisioningFields(provisioningEnabled, req.AdminUsername, req.AdminPassword); err != nil {
		log.Printf("[enrollment-provisioning] save failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save enrollment provisioning settings"})
		return
	}

	settings, err := getOrCreateEnrollmentSettings()
	if err != nil {
		log.Printf("[enrollment-provisioning] reload failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment provisioning settings"})
		return
	}

	log.Printf("[enrollment-provisioning] updated provisioning_enabled=%t admin_user=%q", settings.CreateLocalAdmin, settings.AdminUsername)
	c.JSON(http.StatusOK, toEnrollmentProvisioningResponse(settings))
}

func saveEnrollmentProvisioningFields(enabled bool, username, password string) error {
	return db.DB.Model(&models.WindowsEnrollmentProvisioningSettings{}).
		Where("id = ?", enrollmentSettingsID).
		Updates(map[string]interface{}{
			"create_local_admin": enabled,
			"admin_username":     username,
			"admin_password":     password,
			"updated_at":         time.Now().UTC(),
		}).Error
}

func toEnrollmentProvisioningResponse(settings *models.WindowsEnrollmentProvisioningSettings) models.EnrollmentProvisioningResponse {
	return models.EnrollmentProvisioningResponse{
		CreateLocalAdmin:    settings.CreateLocalAdmin,
		ProvisioningEnabled: settings.CreateLocalAdmin,
		AdminUsername:       settings.AdminUsername,
		AdminPassword:       settings.AdminPassword,
	}
}

func loadActiveEnrollmentProvisioning() (*models.WindowsEnrollmentProvisioningSettings, error) {
	settings, err := getOrCreateEnrollmentSettings()
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
