package handlers

import (
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/httputil"
	filestorage "github.com/hmdm/server-windows/internal/storage"
)

const defaultFilesDownloadMbps = 17

// ServeStoredFile streams repository files with throttling and Range support.
func (h *WindowsHandler) ServeStoredFile(c *gin.Context) {
	relativePath, ok := safeStoredFileRelativePath(c.Param("filepath"))
	if !ok {
		c.Status(http.StatusNotFound)
		return
	}

	rootDir := filestorage.FilesDirectory()
	fullPath := filepath.Join(rootDir, relativePath)
	if !isPathWithinRoot(rootDir, fullPath) {
		c.Status(http.StatusNotFound)
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.Status(http.StatusNotFound)
		return
	}

	reader, err := httputil.NewThrottledReadSeeker(fullPath, filesDownloadBytesPerSec())
	if err != nil {
		log.Printf("[serve-file] open failed: path=%q err=%v", fullPath, err)
		c.Status(http.StatusInternalServerError)
		return
	}
	defer reader.Close()

	contentType := mime.TypeByExtension(filepath.Ext(fullPath))
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.Header("Content-Type", contentType)
	c.Header("Accept-Ranges", "bytes")

	http.ServeContent(c.Writer, c.Request, info.Name(), info.ModTime(), reader)
}

func safeStoredFileRelativePath(raw string) (string, bool) {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "/")
	trimmed = strings.TrimPrefix(trimmed, `\`)
	if trimmed == "" {
		return "", false
	}

	clean := filepath.Clean(filepath.FromSlash(trimmed))
	if clean == "." || strings.HasPrefix(clean, "..") {
		return "", false
	}
	return clean, true
}

func isPathWithinRoot(rootDir, fullPath string) bool {
	absRoot, err := filepath.Abs(rootDir)
	if err != nil {
		return false
	}
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(absRoot, absPath)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func filesDownloadBytesPerSec() int {
	if value := strings.TrimSpace(os.Getenv("FILES_DOWNLOAD_MAX_MBPS")); value != "" {
		mbps, err := strconv.Atoi(value)
		if err == nil && mbps > 0 {
			return mbps << 20
		}
	}
	return defaultFilesDownloadMbps << 20
}
