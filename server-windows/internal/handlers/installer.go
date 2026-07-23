package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const downloadTokenPrefix = "win-dl-"

func filesDirectory() string {
	if dir := strings.TrimSpace(os.Getenv("FILES_DIR")); dir != "" {
		return dir
	}
	return "/opt/hmdm/files"
}

// LinkInstaller associates an uploaded MSI (Java Files storage) with an enrollment token.
func (h *WindowsHandler) LinkInstaller(c *gin.Context) {
	var req models.LinkInstallerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	relativePath := sanitizeRelativePath(req.FilesRelativePath)
	if relativePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid files path"})
		return
	}

	fullPath := filepath.Join(filesDirectory(), filepath.FromSlash(relativePath))
	if _, err := os.Stat(fullPath); err != nil {
		if os.IsNotExist(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "installer file not found on server"})
			return
		}
		log.Printf("[link-installer] stat failed: path=%q err=%v", fullPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to access installer file"})
		return
	}

	var record models.WindowsEnrollmentToken
	if err := db.DB.Where("token = ?", req.EnrollmentToken).First(&record).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "enrollment token not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup enrollment token"})
		return
	}

	if record.DownloadUsedAt != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "installer download link already used"})
		return
	}

	downloadToken, err := generateDownloadToken()
	if err != nil {
		log.Printf("[link-installer] generate download token failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate download token"})
		return
	}

	fileName := strings.TrimSpace(req.FileName)
	if fileName == "" {
		fileName = filepath.Base(relativePath)
	}

	record.DownloadToken = downloadToken
	record.InstallerPath = relativePath
	record.InstallerFileName = fileName
	record.PermanentFileURL = strings.TrimSpace(req.PermanentFileURL)

	if err := db.DB.Save(&record).Error; err != nil {
		log.Printf("[link-installer] save failed: token=%q err=%v", req.EnrollmentToken, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link installer"})
		return
	}

	downloadURL := buildDownloadURL(c, downloadToken)
	log.Printf("[link-installer] linked token=%q download=%q path=%q", req.EnrollmentToken, downloadToken, relativePath)

	c.JSON(http.StatusOK, models.LinkInstallerResponse{
		DownloadURL:      downloadURL,
		PermanentFileURL: record.PermanentFileURL,
		DownloadToken:    downloadToken,
	})
}

// DownloadInstaller streams the MSI via a one-time download token (public, no auth).
func (h *WindowsHandler) DownloadInstaller(c *gin.Context) {
	downloadToken := strings.TrimSpace(c.Param("downloadToken"))
	if downloadToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing download token"})
		return
	}

	var record models.WindowsEnrollmentToken
	err := db.DB.Where("download_token = ?", downloadToken).First(&record).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "download link not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup download link"})
		return
	}

	if record.DownloadUsedAt != nil {
		c.JSON(http.StatusGone, gin.H{"error": "download link already used"})
		return
	}

	if record.InstallerPath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "installer not linked"})
		return
	}

	fullPath := filepath.Join(filesDirectory(), filepath.FromSlash(record.InstallerPath))
	if _, err := os.Stat(fullPath); err != nil {
		log.Printf("[download-installer] stat failed: path=%q err=%v", fullPath, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "installer file not found"})
		return
	}

	now := time.Now().UTC()
	result := db.DB.Model(&models.WindowsEnrollmentToken{}).
		Where("id = ? AND download_used_at IS NULL", record.ID).
		Update("download_used_at", now)
	if result.Error != nil {
		log.Printf("[download-installer] mark used failed: token=%q err=%v", downloadToken, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to finalize download"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusGone, gin.H{"error": "download link already used"})
		return
	}

	fileName := record.InstallerFileName
	if fileName == "" {
		fileName = filepath.Base(record.InstallerPath)
	}

	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fileName))
	c.File(fullPath)

	log.Printf("[download-installer] served token=%q path=%q", downloadToken, record.InstallerPath)
}

func generateDownloadToken() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("read random bytes: %w", err)
	}
	return downloadTokenPrefix + hex.EncodeToString(buf), nil
}

func sanitizeRelativePath(raw string) string {
	clean := filepath.ToSlash(filepath.Clean(strings.TrimSpace(raw)))
	clean = strings.TrimPrefix(clean, "/")
	if clean == "" || clean == "." || strings.Contains(clean, "..") {
		return ""
	}
	return clean
}

func buildDownloadURL(c *gin.Context, downloadToken string) string {
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwarded := c.GetHeader("X-Forwarded-Proto"); forwarded != "" {
		scheme = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}

	host := c.Request.Host
	if forwardedHost := c.GetHeader("X-Forwarded-Host"); forwardedHost != "" {
		host = strings.TrimSpace(strings.Split(forwardedHost, ",")[0])
	}

	return fmt.Sprintf("%s://%s/rest/windows/downloads/%s", scheme, host, downloadToken)
}
