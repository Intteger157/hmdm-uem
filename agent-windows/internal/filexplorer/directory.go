//go:build windows

package filexplorer

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

func buildDirListResponse(path string) (dirListMessage, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(path))
	if cleanPath == "" || cleanPath == "." {
		return dirListMessage{}, fmt.Errorf("path is required")
	}

	entries, err := os.ReadDir(cleanPath)
	if err != nil {
		return dirListMessage{}, err
	}

	items := make([]dirListItem, 0, len(entries))
	for _, entry := range entries {
		info, infoErr := entry.Info()
		if infoErr != nil {
			return dirListMessage{}, infoErr
		}

		size := info.Size()
		if entry.IsDir() {
			size = 0
		}

		items = append(items, dirListItem{
			Name:    entry.Name(),
			IsDir:   entry.IsDir(),
			Size:    size,
			ModTime: formatModTime(info.ModTime()),
		})
	}

	return dirListMessage{
		Type:  MessageTypeDirList,
		Path:  cleanPath,
		Items: items,
	}, nil
}

func isAccessDenied(err error) bool {
	if err == nil {
		return false
	}
	if os.IsPermission(err) {
		return true
	}

	var pathErr *os.PathError
	if errors.As(err, &pathErr) {
		if errno, ok := pathErr.Err.(syscall.Errno); ok {
			return errno == syscall.ERROR_ACCESS_DENIED
		}
	}

	lower := strings.ToLower(err.Error())
	return strings.Contains(lower, "access is denied") || strings.Contains(lower, "access denied")
}

func publicErrorMessage(err error) string {
	if err == nil {
		return "unknown error"
	}
	if isAccessDenied(err) {
		return "Access denied"
	}
	return err.Error()
}

func normalizeFilePath(path string) (string, error) {
	cleanPath := filepath.Clean(strings.TrimSpace(path))
	if cleanPath == "" || cleanPath == "." {
		return "", fmt.Errorf("path is required")
	}
	return cleanPath, nil
}
