package middleware

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/auth"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const ContextValidatedDeviceKey = "device_auth.device"

// RequireDeviceAuth validates per-device or legacy agent credentials and stores
// the resolved device on the Gin context.
func RequireDeviceAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !AuthenticateDeviceRequest(c) {
			return
		}
		c.Next()
	}
}

// RequireConsoleOrDeviceAuth allows either a verified console JWT (set by
// AdminOrAgent) or a validated device agent token.
func RequireConsoleOrDeviceAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, ok := CurrentUser(c); ok {
			c.Next()
			return
		}
		if !AuthenticateDeviceRequest(c) {
			return
		}
		c.Next()
	}
}

// AuthenticateDeviceRequest validates the caller as an enrolled Windows agent.
// It aborts the request with an HTTP error when authentication fails.
func AuthenticateDeviceRequest(c *gin.Context) bool {
	hardwareID := resolveAgentHardwareID(c)
	if hardwareID == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
		return false
	}

	rawToken := extractBearerToken(c.GetHeader("Authorization"))
	if rawToken == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return false
	}

	if db.DB == nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
		return false
	}

	var device models.WindowsDevice
	err := db.DB.Where("hardware_id = ?", hardwareID).First(&device).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unknown device"})
		return false
	}
	if err != nil {
		log.Printf("[device-auth] lookup failed: hardware_id=%q err=%v", hardwareID, err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to authenticate device"})
		return false
	}

	if strings.TrimSpace(device.AgentTokenHash) != "" {
		if auth.HashAgentToken(rawToken) != device.AgentTokenHash {
			log.Printf("[device-auth] rejected token mismatch: hardware_id=%q", hardwareID)
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid agent token"})
			return false
		}
		c.Set(ContextValidatedDeviceKey, device)
		return true
	}

	if auth.IsLegacyAgentToken(rawToken) {
		if !auth.AllowLegacyAgentTokens() {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "legacy agent tokens are disabled"})
			return false
		}
		log.Printf("[device-auth] legacy token accepted (migration pending): hardware_id=%q", hardwareID)
		c.Set(ContextValidatedDeviceKey, device)
		return true
	}

	log.Printf("[device-auth] rejected unknown token: hardware_id=%q", hardwareID)
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid agent token"})
	return false
}

// ValidatedDevice returns the device attached by RequireDeviceAuth.
func ValidatedDevice(c *gin.Context) (models.WindowsDevice, bool) {
	value, ok := c.Get(ContextValidatedDeviceKey)
	if !ok {
		return models.WindowsDevice{}, false
	}
	device, ok := value.(models.WindowsDevice)
	return device, ok
}

func resolveAgentHardwareID(c *gin.Context) string {
	if id := strings.TrimSpace(c.GetHeader("X-Device-Id")); id != "" {
		return id
	}
	return strings.TrimSpace(c.Param("hardwareId"))
}

func extractBearerToken(header string) string {
	header = strings.TrimSpace(header)
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}
