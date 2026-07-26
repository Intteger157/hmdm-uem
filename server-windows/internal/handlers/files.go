package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
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
	if err := filestorage.EnsureFilesDirectory(); err != nil {
		log.Printf("[upload-file] ensure directory failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare upload directory"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing file upload"})
		return
	}
	if fileHeader.Size > 0 && fileHeader.Size > maxFileUploadBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": "file exceeds upload size limit"})
		return
	}

	originalName := filepath.Base(strings.TrimSpace(fileHeader.Filename))
	if originalName == "" || originalName == "." {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid file name"})
		return
	}

	ext := filepath.Ext(originalName)
	storedName := uuid.NewString() + ext
	destPath := filepath.Join(filestorage.FilesDirectory(), storedName)

	src, err := fileHeader.Open()
	if err != nil {
		log.Printf("[upload-file] open upload failed: name=%q err=%v", originalName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read uploaded file"})
		return
	}
	defer src.Close()

	dest, err := os.Create(destPath)
	if err != nil {
		log.Printf("[upload-file] create destination failed: path=%q err=%v", destPath, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}

	hasher := sha256.New()
	written, err := io.Copy(io.MultiWriter(dest, hasher), src)
	closeErr := dest.Close()
	if err != nil {
		os.Remove(destPath)
		log.Printf("[upload-file] stream save failed: name=%q err=%v", storedName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}
	if closeErr != nil {
		os.Remove(destPath)
		log.Printf("[upload-file] close destination failed: name=%q err=%v", storedName, closeErr)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}
	if written == 0 {
		os.Remove(destPath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "empty file upload"})
		return
	}
	if written > maxFileUploadBytes {
		os.Remove(destPath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "file exceeds upload size limit"})
		return
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

	var record models.StoredFile
	if err := db.DB.First(&record, fileID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup file"})
		return
	}

	var usageCount int64
	if err := db.DB.Model(&models.ProfileFileDeployment{}).Where("file_id = ?", fileID).Count(&usageCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate file usage"})
		return
	}
	if usageCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "file is used in configuration deployments"})
		return
	}

	if err := db.DB.Delete(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete file"})
		return
	}

	destPath := filepath.Join(filestorage.FilesDirectory(), record.Filename)
	if err := os.Remove(destPath); err != nil && !os.IsNotExist(err) {
		log.Printf("[delete-file] remove disk file failed: path=%q err=%v", destPath, err)
	}

	log.Printf("[delete-file] deleted id=%d name=%q", record.ID, record.OriginalName)
	c.Status(http.StatusNoContent)
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
