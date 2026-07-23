package handlers

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hmdm/server-windows/internal/metadata"
	"github.com/hmdm/server-windows/internal/models"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

const maxAppUploadBytes int64 = 256 << 20

// UploadApplication stores a local installer and returns parsed metadata.
func (h *WindowsHandler) UploadApplication(c *gin.Context) {
	if err := appstorage.EnsureAppsDirectory(); err != nil {
		log.Printf("[upload-application] ensure directory failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare upload directory"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file upload"})
		return
	}
	if fileHeader.Size <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty file upload"})
		return
	}
	if fileHeader.Size > maxAppUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file exceeds upload size limit"})
		return
	}

	originalName := filepath.Base(strings.TrimSpace(fileHeader.Filename))
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext != ".exe" && ext != ".msi" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only .exe and .msi files are supported"})
		return
	}

	storedName := uuid.NewString() + ext
	destPath := filepath.Join(appstorage.AppsDirectory(), storedName)

	if err := c.SaveUploadedFile(fileHeader, destPath); err != nil {
		log.Printf("[upload-application] save failed: name=%q err=%v", storedName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}

	parsed, parseErr := metadata.ParseInstallerMetadata(destPath)
	name := strings.TrimSpace(parsed.Name)
	version := strings.TrimSpace(parsed.Version)
	if parseErr != nil || name == "" {
		name = metadata.FallbackName(originalName)
	}

	publicPath := fmt.Sprintf("/storage/apps/%s", storedName)
	publicURL := normalizeDownloadURL(buildPublicURL(c, publicPath))

	log.Printf("[upload-application] stored path=%q url=%q name=%q version=%q", destPath, publicURL, name, version)
	c.JSON(http.StatusOK, models.UploadApplicationResponse{
		URL:     publicURL,
		Name:    name,
		Version: version,
	})
}
