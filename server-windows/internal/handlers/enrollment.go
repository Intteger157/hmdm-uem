package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const enrollmentTokenPrefix = "win-enroll-"

// CreateEnrollmentToken issues a unique enrollment token for a new Windows agent.
func (h *WindowsHandler) CreateEnrollmentToken(c *gin.Context) {
	token, err := generateEnrollmentToken()
	if err != nil {
		log.Printf("[enrollment-token] generate failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate enrollment token"})
		return
	}

	record := models.WindowsEnrollmentToken{
		Token:     token,
		CreatedAt: time.Now().UTC(),
	}
	if err := db.DB.Create(&record).Error; err != nil {
		log.Printf("[enrollment-token] persist failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store enrollment token"})
		return
	}

	log.Printf("[enrollment-token] created token=%q id=%d", token, record.ID)

	response := models.EnrollmentTokenResponse{
		Token:               token,
		InstallerConfigured: hasDefaultInstaller(),
	}

	if installer, ok := loadDefaultInstaller(); ok {
		downloadURL, permanentURL, err := linkEnrollmentToInstaller(c, &record, installer)
		if err != nil {
			log.Printf("[enrollment-token] link installer failed: token=%q err=%v", token, err)
		} else {
			response.DownloadURL = downloadURL
			response.PermanentFileURL = permanentURL
			response.EnrollScript = buildEnrollScript(token)
			response.InstallerConfigured = true
		}
	}

	c.JSON(http.StatusOK, response)
}

func generateEnrollmentToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return enrollmentTokenPrefix + hex.EncodeToString(buf), nil
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

	if record.UsedAt == nil {
		return nil
	}

	if record.UsedByHWID == hardwareID {
		return nil
	}

	return fmt.Errorf("enrollment token already used")
}

func markEnrollmentTokenUsed(token, hardwareID string) error {
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
