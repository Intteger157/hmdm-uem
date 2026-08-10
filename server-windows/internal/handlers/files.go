package handlers

import (
	"crypto/sha256"
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
	"github.com/google/uuid"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	filestorage "github.com/hmdm/server-windows/internal/storage"
	"gorm.io/gorm"
)

const maxFileUploadBytes int64 = 10 << 30

// ListStoredFiles returns uploaded repository files.
func (h *WindowsHandler) ListStoredFiles(c *gin.Context) {
	var files []models.StoredFile
	var total int64

	if err := db.DB.Model(&models.StoredFile{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count files"})
		return
	}

	if err := db.DB.Order("upload_date DESC, id DESC").Find(&files).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list files"})
		return
	}

	items := make([]models.StoredFileJSON, 0, len(files))
	for _, file := range files {
		items = append(items, toStoredFileJSON(c, file))
	}

	c.JSON(http.StatusOK, models.StoredFileListResponse{
		Items:           items,
		TotalItemsCount: total,
	})
}

// UploadStoredFile stores one repository file with streaming upload.
func (h *WindowsHandler) UploadStoredFile(c *gin.Context) {
	uploadDir := filestorage.FilesDirectory()
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		log.Printf("[upload-file] create upload directory failed: dir=%q err=%v", uploadDir, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
		return
	}

	ext := filepath.Ext("placeholder")
	storedName := uuid.NewString() + ext
	destPath := filepath.Join(uploadDir, storedName)

	hasher := sha256.New()
	originalName, _, written, err := streamMultipartUploadToFile(
		c.Writer,
		c.Request,
		destPath,
		maxFileUploadBytes,
		hasher,
	)
	if err != nil {
		os.Remove(destPath)
		if status, message := multipartUploadErrorStatus(err); message != "" {
			c.JSON(status, gin.H{"error": message})
			return
		}
		log.Printf("[upload-file] stream read failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + err.Error()})
		return
	}

	ext = filepath.Ext(originalName)
	if ext != "" {
		finalStoredName := strings.TrimSuffix(storedName, filepath.Ext(storedName)) + ext
		finalDestPath := filepath.Join(uploadDir, finalStoredName)
		if finalDestPath != destPath {
			if renameErr := os.Rename(destPath, finalDestPath); renameErr != nil {
				os.Remove(destPath)
				log.Printf("[upload-file] rename failed: from=%q to=%q err=%v", destPath, finalDestPath, renameErr)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file: " + renameErr.Error()})
				return
			}
			destPath = finalDestPath
			storedName = finalStoredName
		}
	}

	now := time.Now()
	record := models.StoredFile{
		Filename:     storedName,
		OriginalName: originalName,
		SizeBytes:    written,
		SHA256:       hex.EncodeToString(hasher.Sum(nil)),
		UploadDate:   now,
	}

	if err := db.DB.Create(&record).Error; err != nil {
		os.Remove(destPath)
		log.Printf("[upload-file] db create failed: name=%q err=%v", originalName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file metadata"})
		return
	}

	log.Printf("[upload-file] stored id=%d name=%q size=%d", record.ID, originalName, written)
	c.JSON(http.StatusCreated, toStoredFileJSON(c, record))
}

// DeleteStoredFile removes one repository file.
func (h *WindowsHandler) DeleteStoredFile(c *gin.Context) {
	fileID, ok := parseUintParam(c.Param("id"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file id"})
		return
	}

	forceDelete := parseForceDeleteQuery(c.Query("force"))

	var record models.StoredFile
	if err := db.DB.First(&record, fileID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup file"})
		return
	}

	if !forceDelete {
		var usageCount int64
		if err := db.DB.Model(&models.ProfileFileDeployment{}).Where("file_id = ?", fileID).Count(&usageCount).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate file usage"})
			return
		}
		if usageCount > 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "file is used in configuration deployments"})
			return
		}
	}

	if err := db.DB.Transaction(func(tx *gorm.DB) error {
		if forceDelete {
			if err := tx.Where("file_id = ?", fileID).Delete(&models.ProfileFileDeployment{}).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&record).Error
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete file"})
		return
	}

	destPath := filepath.Join(filestorage.FilesDirectory(), record.Filename)
	if err := os.Remove(destPath); err != nil && !os.IsNotExist(err) {
		log.Printf("[delete-file] remove disk file failed: path=%q err=%v", destPath, err)
	}

	if forceDelete {
		log.Printf("[delete-file] force deleted id=%d name=%q", record.ID, record.OriginalName)
	} else {
		log.Printf("[delete-file] deleted id=%d name=%q", record.ID, record.OriginalName)
	}
	c.Status(http.StatusNoContent)
}

func parseForceDeleteQuery(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes":
		return true
	default:
		return false
	}
}

func toStoredFileJSON(c *gin.Context, file models.StoredFile) models.StoredFileJSON {
	publicPath := fmt.Sprintf("/storage/files/%s", file.Filename)
	return models.StoredFileJSON{
		ID:           file.ID,
		Filename:     file.Filename,
		OriginalName: file.OriginalName,
		SizeBytes:    file.SizeBytes,
		SHA256:       file.SHA256,
		UploadDate:   file.UploadDate,
		DownloadURL:  normalizeDownloadURL(buildPublicURL(c, publicPath)),
	}
}

func storedFilePublicURL(c *gin.Context, file models.StoredFile) string {
	return toStoredFileJSON(c, file).DownloadURL
}
