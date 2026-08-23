package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
)

// RefreshAgentToken upgrades a device from the legacy shared token to a unique secret.
func (h *WindowsHandler) RefreshAgentToken(c *gin.Context) {
	hardwareID := strings.TrimSpace(c.GetHeader("X-Device-Id"))
	if hardwareID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-Device-Id header"})
		return
	}

	rawToken := extractBearerToken(c.GetHeader("Authorization"))
	if rawToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
		return
	}

	device, err := authenticateAgentToken(hardwareID, rawToken)
	if err != nil {
		respondAgentTokenError(c, err)
		return
	}

	newToken, err := issueAgentToken(&device)
	if err != nil {
		log.Printf("[token-refresh] issue failed: hardware_id=%q err=%v", hardwareID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue agent token"})
		return
	}

	c.JSON(http.StatusOK, models.EnrollResponse{AuthToken: newToken})
}

func extractBearerToken(header string) string {
	header = strings.TrimSpace(header)
	if header == "" || !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func respondAgentTokenError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, errMissingHardwareID):
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing hardware id"})
	case errors.Is(err, errMissingAgentToken):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing or invalid authorization header"})
	case errors.Is(err, errDatabaseUnavailable):
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database unavailable"})
	case errors.Is(err, errDeviceNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
	case errors.Is(err, errLegacyTokenRetired):
		c.JSON(http.StatusForbidden, gin.H{"error": "legacy token is no longer accepted for this device"})
	case errors.Is(err, errLegacyTokenDisabled):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "legacy agent tokens are disabled"})
	case errors.Is(err, errInvalidAgentToken):
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent token"})
	default:
		log.Printf("[token-refresh] unexpected auth error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to authenticate device"})
	}
}