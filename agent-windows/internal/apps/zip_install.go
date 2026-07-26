//go:build windows

package apps

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func isZipInstaller(path string) bool {
	return strings.EqualFold(filepath.Ext(path), ".zip")
}

func isZipContentType(contentType string) bool {
	return strings.EqualFold(strings.TrimSpace(contentType), "application/zip")
}

func runZipInstaller(zipPath, installArgs string) (installRunResult, error) {
	customArgs := strings.TrimSpace(installArgs)
	if customArgs == "" {
		return installRunResult{}, fmt.Errorf("zip install requires installArgs")
	}

	tempDir, err := os.MkdirTemp("", "mdm-app-extract-*")
	if err != nil {
		return installRunResult{}, fmt.Errorf("create extract directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	if err := extractZipArchive(zipPath, tempDir); err != nil {
		return installRunResult{}, fmt.Errorf("extract zip: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), appInstallTimeout)
	defer cancel()

	args := strings.Fields(customArgs)
	if len(args) == 0 {
		return installRunResult{}, fmt.Errorf("invalid installArgs")
	}

	cmdLine := fmt.Sprintf(`%s (cwd=%s)`, customArgs, tempDir)
	return runPreparedInstaller(ctx, args[0], args[1:], cmdLine, tempDir, true)
}

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
