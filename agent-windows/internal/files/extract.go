//go:build windows

package files

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func extractZipArchive(zipPath, destDir string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	destDir = filepath.Clean(destDir)

	for _, file := range reader.File {
		targetPath, err := safeZipExtractPath(destDir, file.Name)
		if err != nil {
			return err
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return err
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
			return err
		}

		src, err := file.Open()
		if err != nil {
			return err
		}

		dest, err := os.OpenFile(targetPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, file.Mode().Perm())
		if err != nil {
			src.Close()
			return err
		}

		_, copyErr := io.Copy(dest, src)
		closeSrcErr := src.Close()
		closeDestErr := dest.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeSrcErr != nil {
			return closeSrcErr
		}
		if closeDestErr != nil {
			return closeDestErr
		}
	}

	return nil
}

func safeZipExtractPath(destDir, name string) (string, error) {
	cleanName := filepath.Clean(strings.ReplaceAll(name, `\`, `/`))
	if cleanName == "." || cleanName == ".." || strings.HasPrefix(cleanName, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("illegal path in zip: %q", name)
	}

	targetPath := filepath.Join(destDir, filepath.FromSlash(cleanName))
	absDest, err := filepath.Abs(destDir)
	if err != nil {
		return "", err
	}
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return "", err
	}

	rel, err := filepath.Rel(absDest, absTarget)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("illegal path in zip: %q", name)
	}

	return targetPath, nil
}
