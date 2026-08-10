package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
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

	destPath := filepath.Join(appstorage.AppsDirectory(), uuid.NewString()+".tmp")
	originalName, fields, written, err := streamMultipartUploadToFile(
		c.Writer,
		c.Request,
		destPath,
		maxAppUploadBytes,
	)
	if err != nil {
		os.Remove(destPath)
		if status, message := multipartUploadErrorStatus(err); message != "" {
			c.JSON(status, gin.H{"error": message})
			return
		}
		log.Printf("[upload-application] stream read failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}

	ext := strings.ToLower(filepath.Ext(originalName))
	if ext != ".exe" && ext != ".msi" {
		os.Remove(destPath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "only .exe and .msi files are supported"})
		return
	}

	storedName := uuid.NewString() + ext
	finalPath := filepath.Join(appstorage.AppsDirectory(), storedName)
	if err := os.Rename(destPath, finalPath); err != nil {
		os.Remove(destPath)
		log.Printf("[upload-application] rename failed: from=%q to=%q err=%v", destPath, finalPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}
	destPath = finalPath

	targetAppID, ok := parseOptionalAppID(fields["appId"])
	if !ok {
		os.Remove(destPath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid appId"})
		return
	}

	if err := metadata.ValidateInstallerFile(destPath, originalName); err != nil {
		os.Remove(destPath)
		log.Printf("[upload-application] metadata validation failed: name=%q err=%v", originalName, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read installer metadata"})
		return
	}

	overrideVersion := strings.TrimSpace(fields["version"])
	overridePublisher := strings.TrimSpace(fields["publisher"])
	parsed := resolveUploadMetadata(destPath, originalName, overrideVersion, overridePublisher)
	name := strings.TrimSpace(parsed.Name)
	version := strings.TrimSpace(parsed.Version)
	publisher := strings.TrimSpace(parsed.Publisher)

	detectedArgs, detectErr := metadata.DetectInstallerArgs(destPath)
	if detectErr != nil {
		os.Remove(destPath)
		log.Printf("[upload-application] installer detection failed: name=%q err=%v", originalName, detectErr)
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read installer metadata"})
		return
	}

	publicPath := fmt.Sprintf("/storage/apps/%s", storedName)
	publicURL := normalizeDownloadURL(buildPublicURL(c, publicPath))

	// New catalog entries stage the uploaded file only; persist happens on POST /apps.
	if targetAppID == 0 {
		log.Printf("[upload-application] staged path=%q name=%q version=%q publisher=%q size=%d detectedArgs=%q", destPath, name, version, publisher, written, detectedArgs)
		c.JSON(http.StatusOK, models.UploadApplicationResponse{
			URL:           publicURL,
			Name:          name,
			Version:       version,
			Publisher:     publisher,
			SuggestedArgs: detectedArgs,
		})
		return
	}

	var app models.Application
	if err := db.DB.First(&app, targetAppID).Error; err != nil {
		os.Remove(destPath)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "application not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup application"})
		return
	}
	name = app.Name

	if publisher != "" {
		app.Publisher = publisher
		if err := db.DB.Model(&app).Update("publisher", publisher).Error; err != nil {
			log.Printf("[upload-application] publisher update failed: app_id=%d err=%v", app.ID, err)
		}
	}

	installArgs := strings.TrimSpace(fields["installArgs"])
	if installArgs == "" {
		installArgs = detectedArgs
	}

	appVersion, err := createUploadedApplicationVersion(app, false, version, publicURL, installArgs)
	if err != nil {
		os.Remove(destPath)
		log.Printf("[upload-application] version create failed: app_id=%d err=%v", app.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save application version"})
		return
	}

	if err := requeueLatestAppVersionDeployments(app.ID, appVersion); err != nil {
		log.Printf("[upload-application] requeue failed: app_id=%d version_id=%d err=%v", app.ID, appVersion.ID, err)
	}

	log.Printf("[upload-application] stored path=%q app_id=%d version_id=%d name=%q version=%q publisher=%q size=%d detectedArgs=%q", destPath, app.ID, appVersion.ID, name, version, publisher, written, detectedArgs)
	c.JSON(http.StatusOK, models.UploadApplicationResponse{
		URL:           publicURL,
		Name:          name,
		Version:       appVersion.Version,
		Publisher:     app.Publisher,
		SuggestedArgs: detectedArgs,
		AppID:         app.ID,
		VersionID:     appVersion.ID,
		IsNewApp:      false,
	})
}
