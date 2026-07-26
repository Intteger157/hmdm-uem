package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const filesSubdir = "files"

// FilesDirectory returns the on-disk directory for uploaded repository files.
func FilesDirectory() string {
	if dir := strings.TrimSpace(os.Getenv("FILES_UPLOAD_DIR")); dir != "" {
		return dir
	}
	return filepath.Join(filesDirectory(), filesSubdir)
}

// EnsureFilesDirectory creates the repository upload directory if missing.
func EnsureFilesDirectory() error {
	dir := FilesDirectory()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create files directory: %w", err)
	}
	return nil
}
