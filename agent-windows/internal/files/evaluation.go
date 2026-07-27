//go:build windows

package files

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hmdm/agent-windows/internal/brand"
)

// EvaluateFileDeployment returns one evaluation report line for a file deployment rule.
func EvaluateFileDeployment(deployment RequiredFileDeployment, state FilesState) string {
	cacheRoot, err := fileCacheRoot()
	if err != nil {
		return fmt.Sprintf("- File [%s]: Queued for download", displayFileName(deployment))
	}
	return evaluateFileDeploymentInCache(deployment, state, cacheRoot)
}

func evaluateFileDeploymentInCache(deployment RequiredFileDeployment, state FilesState, cacheRoot string) string {
	name := displayFileName(deployment)
	if state.ShouldSkipDeploy(deployment) {
		return fmt.Sprintf("- File [%s]: Already deployed", name)
	}

	cachePath := filepath.Join(cacheRoot, cacheFileName(deployment))
	if matchesFileFingerprint(cachePath, deployment.SizeBytes, deployment.SHA256) {
		return fmt.Sprintf("- File [%s]: Exists in cache, ready for post-action", name)
	}
	return fmt.Sprintf("- File [%s]: Queued for download", name)
}

func displayFileName(deployment RequiredFileDeployment) string {
	name := strings.TrimSpace(deployment.OriginalName)
	if name == "" {
		return fmt.Sprintf("File #%d", deployment.FileID)
	}
	return name
}

func fileCacheRoot() (string, error) {
	cacheDir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return "", err
	}
	cacheRoot := filepath.Join(cacheDir, "file_cache")
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return "", err
	}
	return cacheRoot, nil
}

func cacheFilePath(deployment RequiredFileDeployment) (string, error) {
	cacheRoot, err := fileCacheRoot()
	if err != nil {
		return "", err
	}
	return filepath.Join(cacheRoot, cacheFileName(deployment)), nil
}

func cacheFileName(deployment RequiredFileDeployment) string {
	return fmt.Sprintf("%d_%s%s", deployment.FileID, deployment.SHA256, filepath.Ext(deployment.OriginalName))
}
