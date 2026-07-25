package storage

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const appsPublicPrefix = "/storage/apps/"

// LocalPathFromAppFileURL maps a public installer URL to an on-disk apps upload path.
func LocalPathFromAppFileURL(fileURL string) (string, bool) {
	fileURL = strings.TrimSpace(fileURL)
	if fileURL == "" {
		return "", false
	}

	pathPart := fileURL
	if strings.Contains(fileURL, "://") {
		parsed, err := url.Parse(fileURL)
		if err != nil {
			return "", false
		}
		pathPart = parsed.Path
	}

	if !strings.HasPrefix(pathPart, appsPublicPrefix) {
		return "", false
	}

	filename := filepath.Base(pathPart)
	if filename == "" || filename == "." || filename == string(filepath.Separator) {
		return "", false
	}

	return filepath.Join(AppsDirectory(), filename), true
}

// DeleteStoredAppFile removes a locally stored installer referenced by a public apps URL.
func DeleteStoredAppFile(fileURL string) (localPath string, deleted bool, err error) {
	localPath, ok := LocalPathFromAppFileURL(fileURL)
	if !ok {
		return "", false, nil
	}

	if _, statErr := os.Stat(localPath); os.IsNotExist(statErr) {
		return localPath, false, nil
	}

	if err := os.Remove(localPath); err != nil {
		return localPath, false, fmt.Errorf("remove installer file: %w", err)
	}

	return localPath, true, nil
}
