//go:build windows

package files

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeploymentFailureMessageIncludesSystemError(t *testing.T) {
	t.Parallel()

	err := fmt.Errorf("create download directory: %w", errors.New("The system cannot find the path specified."))
	message := deploymentFailureMessage("", err)
	if message == "" {
		t.Fatal("expected non-empty failure message")
	}
	if !strings.Contains(message, "create download directory") {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
	if !strings.Contains(message, "The system cannot find the path specified.") {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
}

func TestDeploymentFailureMessageMergesOutputAndError(t *testing.T) {
	t.Parallel()

	message := deploymentFailureMessage("script output", errors.New("exit status 1"))
	if message != "script output\nexit status 1" {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
}

func TestTryReuseExistingDownloadMatchesRemoteSize(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	cachePath := filepath.Join(dir, "archive.zip")
	payload := []byte("cached-payload")
	if err := os.WriteFile(cachePath, payload, 0o644); err != nil {
		t.Fatal(err)
	}

	deployment := RequiredFileDeployment{
		SizeBytes: int64(len(payload)),
	}

	reused, err := tryReuseExistingDownload(cachePath, int64(len(payload)), deployment)
	if err != nil {
		t.Fatalf("tryReuseExistingDownload() error = %v", err)
	}
	if !reused {
		t.Fatal("expected cached file to be reused")
	}
}

func TestTryReuseExistingDownloadRemovesMismatchedSize(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	cachePath := filepath.Join(dir, "archive.zip")
	if err := os.WriteFile(cachePath, []byte("partial"), 0o644); err != nil {
		t.Fatal(err)
	}

	reused, err := tryReuseExistingDownload(cachePath, 4096, RequiredFileDeployment{})
	if err != nil {
		t.Fatalf("tryReuseExistingDownload() error = %v", err)
	}
	if reused {
		t.Fatal("expected mismatched file not to be reused")
	}
	if _, statErr := os.Stat(cachePath); !os.IsNotExist(statErr) {
		t.Fatalf("expected mismatched cache file to be removed, stat err=%v", statErr)
	}
}
