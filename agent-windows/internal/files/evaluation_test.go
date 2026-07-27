//go:build windows

package files

import (
	"os"
	"path/filepath"
	"testing"
)

func TestEvaluateFileDeploymentCached(t *testing.T) {
	t.Parallel()

	cacheRoot := t.TempDir()
	deployment := RequiredFileDeployment{
		ID:           10,
		FileID:       5,
		OriginalName: "tool.zip",
		SizeBytes:    11,
	}
	cachePath := filepath.Join(cacheRoot, cacheFileName(deployment))
	if err := os.WriteFile(cachePath, []byte("hello world"), 0o644); err != nil {
		t.Fatal(err)
	}

	line := evaluateFileDeploymentInCache(deployment, newEmptyFilesState(), cacheRoot)
	want := "- File [tool.zip]: Exists in cache, ready for post-action"
	if line != want {
		t.Fatalf("evaluateFileDeploymentInCache() = %q, want %q", line, want)
	}
}

func TestEvaluateFileDeploymentQueued(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{ID: 11, FileID: 6, OriginalName: "missing.bin", SizeBytes: 100}
	line := evaluateFileDeploymentInCache(deployment, newEmptyFilesState(), t.TempDir())
	if line != "- File [missing.bin]: Queued for download" {
		t.Fatalf("evaluateFileDeploymentInCache() = %q", line)
	}
}

func TestEvaluateFileDeploymentAlreadyDeployed(t *testing.T) {
	t.Parallel()

	state := newEmptyFilesState()
	state.MarkDeployed(RequiredFileDeployment{ID: 12, OriginalName: "done.txt", UpdatedAt: "2026-07-27T10:00:00Z"})
	deployment := RequiredFileDeployment{ID: 12, OriginalName: "done.txt", UpdatedAt: "2026-07-27T10:00:00Z"}
	line := evaluateFileDeploymentInCache(deployment, state, t.TempDir())
	if line != "- File [done.txt]: Already deployed" {
		t.Fatalf("evaluateFileDeploymentInCache() = %q", line)
	}
}
