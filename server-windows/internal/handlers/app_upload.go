package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/metadata"
	"github.com/hmdm/server-windows/internal/models"
	appstorage "github.com/hmdm/server-windows/internal/storage"
	"gorm.io/gorm"
)

const maxAppUploadBytes int64 = 256 << 20

// UploadApplication stores a local installer, creates/links a catalog version, and returns parsed metadata.
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

	targetAppID, ok := parseOptionalAppID(c.PostForm("appId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appId"})
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
	filenameMeta := metadata.ParseFilenameMetadata(originalName)

	name := strings.TrimSpace(parsed.Name)
	version := strings.TrimSpace(parsed.Version)
	if name == "" {
		name = strings.TrimSpace(filenameMeta.Name)
	}
	if name == "" {
		name = metadata.FallbackName(originalName)
	}
	if version == "" {
		version = strings.TrimSpace(filenameMeta.Version)
	}
	if parseErr != nil && name == strings.TrimSpace(filenameMeta.Name) {
		log.Printf("[upload-application] metadata parse fallback to filename: name=%q err=%v", originalName, parseErr)
	}

	detectedArgs, detectErr := metadata.DetectInstallerArgs(destPath)
	if detectErr != nil {
		log.Printf("[upload-application] installer detection failed: name=%q err=%v", originalName, detectErr)
	}

	publicPath := fmt.Sprintf("/storage/apps/%s", storedName)
	publicURL := normalizeDownloadURL(buildPublicURL(c, publicPath))

	var app models.Application
	isNewApp := false
	if targetAppID > 0 {
		if err := db.DB.First(&app, targetAppID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
			return
		}
		name = app.Name
	} else {
		var findErr error
		app, isNewApp, findErr = findOrCreateApplicationByName(name)
		if findErr != nil {
			log.Printf("[upload-application] app lookup/create failed: name=%q err=%v", name, findErr)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create application record"})
			return
		}
	}

	installArgs := strings.TrimSpace(c.PostForm("installArgs"))
	if installArgs == "" {
		installArgs = detectedArgs
	}

	appVersion, err := createUploadedApplicationVersion(app, isNewApp, version, publicURL, installArgs)
	if err != nil {
		log.Printf("[upload-application] version create failed: app_id=%d err=%v", app.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save application version"})
		return
	}

	log.Printf("[upload-application] stored path=%q app_id=%d version_id=%d name=%q version=%q detectedArgs=%q", destPath, app.ID, appVersion.ID, name, version, detectedArgs)
	c.JSON(http.StatusOK, models.UploadApplicationResponse{
		URL:          publicURL,
		Name:         name,
		Version:      appVersion.Version,
		DetectedArgs: detectedArgs,
		AppID:        app.ID,
		VersionID:    appVersion.ID,
		IsNewApp:     isNewApp,
	})
}
