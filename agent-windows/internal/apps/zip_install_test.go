//go:build windows

package apps

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSafeZipExtractPathRejectsTraversal(t *testing.T) {
	t.Parallel()

	destDir := t.TempDir()
	_, err := safeZipExtractPath(destDir, "../escape.txt")
	if err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}

func TestExtractZipArchive(t *testing.T) {
	t.Parallel()

	sourceDir := t.TempDir()
	nestedDir := filepath.Join(sourceDir, "payload")
	if err := os.MkdirAll(nestedDir, 0o755); err != nil {
		t.Fatal(err)
	}
	setupPath := filepath.Join(nestedDir, "setup.exe")
	if err := os.WriteFile(setupPath, []byte("installer"), 0o644); err != nil {
		t.Fatal(err)
	}

	zipPath := filepath.Join(sourceDir, "bundle.zip")
	zipFile, err := os.Create(zipPath)
	if err != nil {
		t.Fatal(err)
	}
	zipWriter := zip.NewWriter(zipFile)
	writer, err := zipWriter.Create("payload/setup.exe")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := writer.Write([]byte("installer")); err != nil {
		t.Fatal(err)
	}
	if err := zipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := zipFile.Close(); err != nil {
		t.Fatal(err)
	}

	destDir := t.TempDir()
	if err := extractZipArchive(zipPath, destDir); err != nil {
		t.Fatalf("extractZipArchive failed: %v", err)
	}

	extractedPath := filepath.Join(destDir, "payload", "setup.exe")
	content, err := os.ReadFile(extractedPath)
	if err != nil {
		t.Fatalf("expected extracted file: %v", err)
	}
	if string(content) != "installer" {
		t.Fatalf("unexpected extracted content: %q", string(content))
	}
}

func TestIsZipInstaller(t *testing.T) {
	t.Parallel()

	if !isZipInstaller(`C:\Temp\office.zip`) {
		t.Fatal("expected .zip path to be detected")
	}
	if isZipInstaller(`C:\Temp\office.exe`) {
		t.Fatal("expected non-zip path to be rejected")
	}
}

func TestIsZipContentType(t *testing.T) {
	t.Parallel()

	if !isZipContentType("application/zip") {
		t.Fatal("expected application/zip to match")
	}
	if isZipContentType("application/x-msdownload") {
		t.Fatal("expected non-zip content type to be rejected")
	}
	if !strings.EqualFold("application/zip", "APPLICATION/ZIP") {
		t.Fatal("zip content type comparison should be case-insensitive")
	}
}
