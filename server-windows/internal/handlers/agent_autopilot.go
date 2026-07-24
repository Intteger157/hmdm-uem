package handlers

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/hmdm/server-windows/internal/metadata"
	"github.com/hmdm/server-windows/internal/models"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

const maxAutopilotAgentUploadBytes int64 = 128 << 20

// GetAutopilotAgent returns bootstrap agent binary status for the admin UI.
func (h *WindowsHandler) GetAutopilotAgent(c *gin.Context) {
	c.JSON(http.StatusOK, buildAutopilotAgentStatus(c))
}

// UploadAutopilotAgent stores singularity-agent.exe for bootstrap enrollment.
func (h *WindowsHandler) UploadAutopilotAgent(c *gin.Context) {
	if err := appstorage.EnsureAgentDirectory(); err != nil {
		log.Printf("[upload-autopilot-agent] ensure directory failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to prepare agent directory"})
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
	if fileHeader.Size > maxAutopilotAgentUploadBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file exceeds upload size limit"})
		return
	}

	originalName := filepath.Base(strings.TrimSpace(fileHeader.Filename))
	if strings.ToLower(filepath.Ext(originalName)) != ".exe" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "only .exe files are supported"})
		return
	}

	tempPath := filepath.Join(appstorage.AutopilotDirectory(), uuid.NewString()+".exe")
	if err := c.SaveUploadedFile(fileHeader, tempPath); err != nil {
		log.Printf("[upload-autopilot-agent] save temp failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save uploaded file"})
		return
	}
	defer os.Remove(tempPath)

	if err := appstorage.ReplaceAgentBinary(tempPath); err != nil {
		log.Printf("[upload-autopilot-agent] publish failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to publish agent binary"})
		return
	}

	meta := appstorage.AgentBinaryMeta{UploadedAt: time.Now().UTC()}
	parsed, parseErr := metadata.ParseInstallerMetadata(appstorage.AgentBinaryPath())
	if parseErr == nil {
		meta.Version = strings.TrimSpace(parsed.Version)
		meta.ProductName = strings.TrimSpace(parsed.Name)
	}
	if meta.Version == "" {
		if filenameMeta := metadata.ParseFilenameMetadata(originalName); filenameMeta.Version != "" {
			meta.Version = strings.TrimSpace(filenameMeta.Version)
		}
	}
	if err := appstorage.SaveAgentBinaryMeta(meta); err != nil {
		log.Printf("[upload-autopilot-agent] save metadata failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "agent uploaded but metadata save failed"})
		return
	}

	log.Printf("[upload-autopilot-agent] published binary version=%q size=%d", meta.Version, fileHeader.Size)
	c.JSON(http.StatusOK, buildAutopilotAgentStatus(c))
}

func buildAutopilotAgentStatus(c *gin.Context) models.AutopilotAgentStatus {
	status := models.AutopilotAgentStatus{
		FileName:  appstorage.AgentBinaryName,
		PublicURL: buildPublicURL(c, appstorage.AgentPublicPath()),
	}

	info, ok := appstorage.AgentBinaryStat()
	if !ok {
		return status
	}

	status.Configured = true
	status.FileSize = info.Size()
	if meta, ok := appstorage.LoadAgentBinaryMeta(); ok {
		status.Version = strings.TrimSpace(meta.Version)
		status.ProductName = strings.TrimSpace(meta.ProductName)
		if !meta.UploadedAt.IsZero() {
			status.UploadedAt = meta.UploadedAt.UTC()
		}
	}
	if status.UploadedAt.IsZero() {
		status.UploadedAt = info.ModTime().UTC()
	}
	return status
}
