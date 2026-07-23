package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const appsSubdir = "apps"

// AppsDirectory returns the on-disk directory for uploaded app installers.
func AppsDirectory() string {
	if dir := strings.TrimSpace(os.Getenv("APPS_UPLOAD_DIR")); dir != "" {
		return dir
	}
	return filepath.Join(filesDirectory(), appsSubdir)
}

// EnsureAppsDirectory creates the upload directory if missing.
func EnsureAppsDirectory() error {
	dir := AppsDirectory()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create apps directory: %w", err)
	}
	return nil
}

func filesDirectory() string {
	if dir := strings.TrimSpace(os.Getenv("FILES_DIR")); dir != "" {
		return dir
	}
	return "./uploads"
}
