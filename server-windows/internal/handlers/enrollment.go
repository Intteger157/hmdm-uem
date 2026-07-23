package handlers

import (
	"crypto/rand"
	"encoding/hex"
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

const (
	enrollmentTokenPrefix    = "win-enroll-"
	orgEnrollmentTokenPrefix = "win-enroll-org-"
)

// GetEnrollmentSetup returns the shared org enrollment secret and universal MSI status.
func (h *WindowsHandler) GetEnrollmentSetup(c *gin.Context) {
	response, err := buildEnrollmentSetupResponse(c)
	if err != nil {
		log.Printf("[enrollment-setup] failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load enrollment setup"})
		return
	}

	c.JSON(http.StatusOK, response)
}

// CreateEnrollmentToken returns enrollment setup (legacy POST alias for the admin UI).
func (h *WindowsHandler) CreateEnrollmentToken(c *gin.Context) {
	h.GetEnrollmentSetup(c)
}

func buildEnrollmentSetupResponse(c *gin.Context) (models.EnrollmentSetupResponse, error) {
	orgToken, err := getOrCreateOrgEnrollmentToken()
	if err != nil {
		return models.EnrollmentSetupResponse{}, err
	}

	response := models.EnrollmentSetupResponse{
		OrgEnrollmentSecret: orgToken,
		InstallerConfigured: hasDefaultInstaller(),
	}

	if installer, ok := loadDefaultInstaller(); ok {
		response.PermanentFileURL = installer.PermanentFileURL
		response.InstallerConfigured = true
	}

	response.BuildCommand = buildMsiCommand(c, orgToken)
	return response, nil
}

func getOrCreateOrgEnrollmentToken() (string, error) {
	var record models.WindowsEnrollmentToken
	err := db.DB.Where("token LIKE ?", orgEnrollmentTokenPrefix+"%").Order("id ASC").First(&record).Error
	if err == nil {
		return record.Token, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", fmt.Errorf("lookup org enrollment token: %w", err)
	}

	token, err := generateOrgEnrollmentToken()
	if err != nil {
		return "", err
	}

	record = models.WindowsEnrollmentToken{
		Token:     token,
		CreatedAt: time.Now().UTC(),
	}
	if err := db.DB.Create(&record).Error; err != nil {
		return "", fmt.Errorf("persist org enrollment token: %w", err)
	}

	log.Printf("[enrollment-setup] created org token=%q id=%d", token, record.ID)
	return token, nil
}

func generateOrgEnrollmentToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return orgEnrollmentTokenPrefix + hex.EncodeToString(buf), nil
}

func generateEnrollmentToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return enrollmentTokenPrefix + hex.EncodeToString(buf), nil
}

func isOrgEnrollmentToken(token string) bool {
	return strings.HasPrefix(token, orgEnrollmentTokenPrefix)
}

func validateEnrollmentToken(token, hardwareID string) error {
	var record models.WindowsEnrollmentToken
	err := db.DB.Where("token = ?", token).First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("invalid enrollment token")
	}
	if err != nil {
		return fmt.Errorf("lookup enrollment token: %w", err)
	}

	if isOrgEnrollmentToken(token) {
		return nil
	}

	if record.UsedAt == nil {
		return nil
	}

	if record.UsedByHWID == hardwareID {
		return nil
	}

	return fmt.Errorf("enrollment token already used")
}

func markEnrollmentTokenUsed(token, hardwareID string) error {
	if isOrgEnrollmentToken(token) {
		return nil
	}

	now := time.Now().UTC()
	result := db.DB.Model(&models.WindowsEnrollmentToken{}).
		Where("token = ? AND used_at IS NULL", token).
		Updates(map[string]interface{}{
			"used_at":      now,
			"used_by_hwid": hardwareID,
		})
	if result.Error != nil {
		return result.Error
	}
	return nil
}

func buildMsiCommand(c *gin.Context, orgToken string) string {
	scheme := "https"
	if c.Request.TLS == nil {
		scheme = "http"
	}
	if forwarded := c.GetHeader("X-Forwarded-Proto"); forwarded != "" {
		scheme = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}

	host := c.Request.Host
	if forwardedHost := c.GetHeader("X-Forwarded-Host"); forwardedHost != "" {
		host = strings.TrimSpace(strings.Split(forwardedHost, ",")[0])
	}

	serverURL := fmt.Sprintf("%s://%s", scheme, host)
	return fmt.Sprintf(
		`.\\agent-windows\\installer\\build-msi.ps1 -ServerUrl "%s" -Token "%s"`,
		serverURL,
		orgToken,
	)
}
