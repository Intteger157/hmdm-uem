package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const ssoSettingsID uint = 1

// GetSSOSettings returns the console SSO configuration.
func (h *WindowsHandler) GetSSOSettings(c *gin.Context) {
	settings, err := getOrCreateSSOSettings()
	if err != nil {
		log.Printf("[sso-settings] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load SSO settings"})
		return
	}

	c.JSON(http.StatusOK, toSSOSettingsResponse(settings))
}

// UpdateSSOSettings saves the console SSO configuration.
func (h *WindowsHandler) UpdateSSOSettings(c *gin.Context) {
	var req models.UpdateSSOSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := getOrCreateSSOSettings()
	if err != nil {
		log.Printf("[sso-settings] load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load SSO settings"})
		return
	}

	req.TenantID = strings.TrimSpace(req.TenantID)
	req.ClientID = strings.TrimSpace(req.ClientID)
	req.ClientSecret = strings.TrimSpace(req.ClientSecret)
	req.Provider = normalizeSSOProvider(req.Provider)

	if req.Enabled {
		if req.TenantID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "tenant ID is required when SSO is enabled"})
			return
		}
		if req.ClientID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "client ID is required when SSO is enabled"})
			return
		}
		if req.ClientSecret == "" && strings.TrimSpace(settings.ClientSecret) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "client secret is required when SSO is enabled"})
			return
		}
	}

	settings.Provider = req.Provider
	settings.Enabled = req.Enabled
	settings.TenantID = req.TenantID
	settings.ClientID = req.ClientID
	if req.ClientSecret != "" {
		settings.ClientSecret = req.ClientSecret
	}
	settings.UpdatedAt = time.Now().UTC()

	if err := db.DB.Model(&models.SSOSettings{}).
		Where("id = ?", settings.ID).
		Updates(map[string]interface{}{
			"provider":      settings.Provider,
			"enabled":       settings.Enabled,
			"tenant_id":     settings.TenantID,
			"client_id":     settings.ClientID,
			"client_secret": settings.ClientSecret,
			"updated_at":    settings.UpdatedAt,
		}).Error; err != nil {
		log.Printf("[sso-settings] save failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save SSO settings"})
		return
	}

	log.Printf("[sso-settings] updated provider=%q enabled=%v", settings.Provider, settings.Enabled)
	c.JSON(http.StatusOK, toSSOSettingsResponse(settings))
}

func toSSOSettingsResponse(settings *models.SSOSettings) models.SSOSettingsResponse {
	return models.SSOSettingsResponse{
		Provider:     settings.Provider,
		Enabled:      settings.Enabled,
		TenantID:     settings.TenantID,
		ClientID:     settings.ClientID,
		ClientSecret: settings.ClientSecret,
	}
}

func normalizeSSOProvider(provider string) string {
	provider = strings.TrimSpace(strings.ToLower(provider))
	if provider == "" {
		return models.SSOProviderEntra
	}
	return provider
}

func getOrCreateSSOSettings() (*models.SSOSettings, error) {
	var settings models.SSOSettings
	err := db.DB.First(&settings, ssoSettingsID).Error
	if err == nil {
		if settings.Provider == "" {
			settings.Provider = models.SSOProviderEntra
		}
		return &settings, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("lookup SSO settings: %w", err)
	}

	settings = models.SSOSettings{
		ID:       ssoSettingsID,
		Provider: models.SSOProviderEntra,
		Enabled:  false,
		UpdatedAt: time.Now().UTC(),
	}
	if err := db.DB.Create(&settings).Error; err != nil {
		return nil, fmt.Errorf("create SSO settings: %w", err)
	}

	return &settings, nil
}
