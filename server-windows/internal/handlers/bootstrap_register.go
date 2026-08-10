package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
)

// RegisterBootstrap validates the bootstrap enrollment secret and returns the org enrollment token.
func (h *WindowsHandler) RegisterBootstrap(c *gin.Context) {
	var req models.BootstrapRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	settings, err := getOrCreateEnrollmentSettings()
	if err != nil {
		log.Printf("[bootstrap-register] settings load failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment settings"})
		return
	}

	if strings.TrimSpace(settings.EnrollmentSecret) == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "enrollment secret is not configured"})
		return
	}

	if enrollmentSecretsMismatch(strings.TrimSpace(req.EnrollmentSecret), settings.EnrollmentSecret) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid enrollment secret"})
		return
	}

	orgToken, err := getOrCreateOrgEnrollmentToken()
	if err != nil {
		log.Printf("[bootstrap-register] org token failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare enrollment token"})
		return
	}

	response := models.BootstrapRegisterResponse{
		EnrollmentToken: orgToken,
	}
	provisioning, err := loadActiveEnrollmentProvisioning()
	if err != nil {
		log.Printf("[bootstrap-register] provisioning settings failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment provisioning settings"})
		return
	}
	if provisioning != nil {
		response.AdminPassword = provisioning.AdminPassword
	}

	c.JSON(http.StatusOK, response)
}

func enrollmentSecretsMismatch(got, expected string) bool {
	if len(got) != len(expected) {
		return true
	}
	var mismatch byte
	for i := 0; i < len(got); i++ {
		mismatch |= got[i] ^ expected[i]
	}
	return mismatch != 0
}

func generateEnrollmentSecret() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return "win-bootstrap-" + hex.EncodeToString(buf), nil
}

func normalizeEnrollmentMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case models.EnrollmentModePassword:
		return models.EnrollmentModePassword
	default:
		return models.EnrollmentModeToken
	}
}
