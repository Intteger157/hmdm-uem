//go:build windows

package files

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"

	"github.com/hmdm/agent-windows/internal/brand"
)

var (
	deployFilesMu      sync.Mutex
	deployFilesRunning atomic.Bool
)

// DeploymentInProgress reports whether file deployment rules are executing right now.
func DeploymentInProgress() bool {
	return deployFilesRunning.Load()
}

// AllDeploymentsSettled reports whether every file rule was applied for its current
// fingerprint, i.e. nothing is pending or failed.
func AllDeploymentsSettled(deployments []RequiredFileDeployment) bool {
	if len(deployments) == 0 {
		return true
	}

	state, err := LoadFilesState()
	if err != nil {
		log.Printf("file deploy: settled check skipped, state load failed: %v", err)
		return false
	}
	for _, deployment := range deployments {
		if !state.ShouldSkipDeploy(deployment) {
			return false
		}
	}
	return true
}

// RequiredFileDeployment is one file deployment rule from effective config.
type RequiredFileDeployment struct {
	ID               uint   `json:"id"`
	FileID           uint   `json:"fileId"`
	OriginalName     string `json:"originalName"`
	DownloadURL      string `json:"downloadUrl"`
	SizeBytes        int64  `json:"sizeBytes"`
	SHA256           string `json:"sha256"`
	DestinationPath  string `json:"destinationPath"`
	Unzip            bool   `json:"unzip"`
	PostActionScript string `json:"postActionScript"`
	UpdatedAt        string `json:"updatedAt"`
}

type DeploymentLogger func(deploymentID, fileID uint, fileName, status, output string) error

type DeployOptions struct {
	BaseURL string
	Logger  DeploymentLogger
}

// DeployRequiredAsync deploys file rules in the background.
func DeployRequiredAsync(deployments []RequiredFileDeployment, opts DeployOptions) {
	if len(deployments) == 0 {
		return
	}
	copy := append([]RequiredFileDeployment(nil), deployments...)
	go func() {
		log.Printf("file deploy: starting async deployment for %d rule(s)", len(copy))
		DeployRequired(copy, opts)
	}()
}

// DeployRequired executes all file deployment rules sequentially.
func DeployRequired(deployments []RequiredFileDeployment, opts DeployOptions) {
	deployFilesMu.Lock()
	defer deployFilesMu.Unlock()

	deployFilesRunning.Store(true)
	defer deployFilesRunning.Store(false)

	state, err := LoadFilesState()
	if err != nil {
		log.Printf("file state load failed: %v", err)
		state = newEmptyFilesState()
	}

	stateChanged := false
	for _, deployment := range deployments {
		if state.ShouldSkipDeploy(deployment) {
			log.Printf("file deploy: skip id=%d file_id=%d destination=%q (already applied)", deployment.ID, deployment.FileID, deployment.DestinationPath)
			continue
		}

		output, deployErr := deployOne(deployment, opts)
		if deployErr != nil {
			log.Printf("file deploy failed id=%d file_id=%d: %v", deployment.ID, deployment.FileID, deployErr)
			reportLog(opts.Logger, deployment, "Failed", deploymentFailureMessage(output, deployErr))
			state.MarkDeployFailed(deployment)
			stateChanged = true
			continue
		}

		reportLog(opts.Logger, deployment, "Success", output)
		state.MarkDeployed(deployment)
		stateChanged = true
	}

	if stateChanged {
		if err := SaveFilesState(state); err != nil {
			log.Printf("file state save failed: %v", err)
		}
	}
}

const skipDownloadActionLogMessage = "File already downloaded. Executing post-action script..."

func deployOne(deployment RequiredFileDeployment, opts DeployOptions) (string, error) {
	reportLog(opts.Logger, deployment, "Downloading", fmt.Sprintf("Downloading %q", deployment.OriginalName))

	downloadURL, err := resolveDownloadURL(opts.BaseURL, deployment.DownloadURL)
	if err != nil {
		return deploymentFailureMessage("", err), err
	}

	localPath, skippedDownload, err := ensureCachedFile(deployment, downloadURL)
	if err != nil {
		wrapped := fmt.Errorf("download file: %w", err)
		return deploymentFailureMessage("", wrapped), wrapped
	}
	if skippedDownload {
		reportLog(opts.Logger, deployment, "Installing", skipDownloadActionLogMessage)
	}

	destination := strings.TrimSpace(deployment.DestinationPath)
	if destination == "" {
		err := fmt.Errorf("destination_path is empty")
		return deploymentFailureMessage("", err), err
	}

	reportLog(opts.Logger, deployment, "Installing", fmt.Sprintf("Deploying to %s", destination))

	if deployment.Unzip {
		if err := os.MkdirAll(destination, 0o755); err != nil {
			wrapped := fmt.Errorf("create destination directory: %w", err)
			return deploymentFailureMessage("", wrapped), wrapped
		}
		if err := extractZipArchive(localPath, destination); err != nil {
			wrapped := fmt.Errorf("extract archive: %w", err)
			return deploymentFailureMessage("", wrapped), wrapped
		}
	} else {
		if err := copyFileToDestination(localPath, destination, deployment.OriginalName); err != nil {
			wrapped := fmt.Errorf("copy file: %w", err)
			return deploymentFailureMessage("", wrapped), wrapped
		}
	}

	script := strings.TrimSpace(deployment.PostActionScript)
	if script == "" {
		return fmt.Sprintf("Deployed %q to %s", deployment.OriginalName, destination), nil
	}

	reportLog(opts.Logger, deployment, "Installing", fmt.Sprintf("Running post-action script: %s", script))
	output, err := runPostActionScript(destination, script)
	if err != nil {
		return deploymentFailureMessage(output, err), fmt.Errorf("post-action script: %w", err)
	}

	message := fmt.Sprintf("Deployed %q to %s", deployment.OriginalName, destination)
	if output != "" {
		message += "\n" + output
	}
	return message, nil
}

func deploymentFailureMessage(output string, err error) string {
	output = strings.TrimSpace(output)
	errMsg := ""
	if err != nil {
		errMsg = strings.TrimSpace(err.Error())
	}

	switch {
	case output != "" && errMsg != "" && !strings.Contains(output, errMsg):
		return output + "\n" + errMsg
	case output != "":
		return output
	case errMsg != "":
		return errMsg
	default:
		return "deployment failed"
	}
}

func copyFileToDestination(sourcePath, destinationPath, originalName string) error {
	targetPath := destinationPath
	if strings.HasSuffix(strings.ToLower(destinationPath), `\`) || strings.HasSuffix(destinationPath, "/") {
		targetPath = filepath.Join(destinationPath, filepath.Base(originalName))
	} else if info, err := os.Stat(destinationPath); err == nil && info.IsDir() {
		targetPath = filepath.Join(destinationPath, filepath.Base(originalName))
	}

	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return err
	}

	src, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer src.Close()

	dest, err := os.Create(targetPath)
	if err != nil {
		return err
	}

	if _, err := io.Copy(dest, src); err != nil {
		dest.Close()
		return err
	}
	return dest.Close()
}

func runPostActionScript(workingDir, script string) (string, error) {
	escapedDir := strings.ReplaceAll(workingDir, "'", "''")
	command := fmt.Sprintf("Set-Location -LiteralPath '%s'; %s", escapedDir, script)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			return "", err
		}
		return message, fmt.Errorf("%w: %s", err, message)
	}
	return message, nil
}

func ensureCachedFile(deployment RequiredFileDeployment, downloadURL string) (string, bool, error) {
	cacheDir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return "", false, err
	}
	cacheRoot := filepath.Join(cacheDir, "file_cache")
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return "", false, err
	}

	cacheName := fmt.Sprintf("%d_%s%s", deployment.FileID, deployment.SHA256, filepath.Ext(deployment.OriginalName))
	cachePath := filepath.Join(cacheRoot, cacheName)
	partialPath := partialDownloadPath(cachePath)

	if matchesFileFingerprint(cachePath, deployment.SizeBytes, deployment.SHA256) {
		log.Printf("file deploy: cached file fingerprint matches, skipping download: %q", cachePath)
		return cachePath, true, nil
	}

	remoteSize, headErr := headRemoteContentLength(downloadURL)
	expectedSize := remoteSize
	if expectedSize <= 0 {
		expectedSize = deployment.SizeBytes
	}

	if headErr == nil && remoteSize > 0 {
		if reused, reuseErr := tryReuseExistingDownload(cachePath, expectedSize, deployment); reuseErr != nil {
			return "", false, reuseErr
		} else if reused {
			log.Printf("file deploy: %s path=%q", skipDownloadLogMessage, cachePath)
			return cachePath, true, nil
		}
	}

	releaseDownload, acquired := acquireFileDownloadLock(cachePath)
	if !acquired {
		log.Printf("file deploy: Download already in progress: %q", cachePath)
		return "", false, fmt.Errorf("%s", downloadAlreadyInProgressMessage)
	}
	defer releaseDownload()

	if err := removeMismatchedDownloadFile(cachePath, expectedSize); err != nil {
		return "", false, err
	}
	if err := removeMismatchedDownloadFile(partialPath, expectedSize); err != nil {
		return "", false, err
	}

	if err := downloadFileResumable(downloadURL, partialPath); err != nil {
		return "", false, err
	}

	if !matchesFileFingerprint(partialPath, deployment.SizeBytes, deployment.SHA256) {
		return "", false, fmt.Errorf("downloaded file fingerprint mismatch")
	}

	if err := os.Remove(cachePath); err != nil && !os.IsNotExist(err) {
		return "", false, err
	}
	if err := os.Rename(partialPath, cachePath); err != nil {
		return "", false, err
	}
	return cachePath, false, nil
}

func tryReuseExistingDownload(cachePath string, expectedSize int64, deployment RequiredFileDeployment) (bool, error) {
	info, err := os.Stat(cachePath)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, err
	}
	if expectedSize <= 0 || info.Size() != expectedSize {
		if removeErr := os.Remove(cachePath); removeErr != nil && !os.IsNotExist(removeErr) {
			return false, removeErr
		}
		return false, nil
	}
	if !localFileMatchesExpectedContent(cachePath, deployment) {
		if removeErr := os.Remove(cachePath); removeErr != nil && !os.IsNotExist(removeErr) {
			return false, removeErr
		}
		return false, nil
	}
	return true, nil
}

func localFileMatchesExpectedContent(path string, deployment RequiredFileDeployment) bool {
	if strings.TrimSpace(deployment.SHA256) != "" {
		hash, err := hashFile(path)
		if err != nil {
			return false
		}
		return strings.EqualFold(hash, deployment.SHA256)
	}
	if deployment.SizeBytes > 0 {
		info, err := os.Stat(path)
		if err != nil {
			return false
		}
		return info.Size() == deployment.SizeBytes
	}
	return true
}

func removeMismatchedDownloadFile(path string, expectedSize int64) error {
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if expectedSize <= 0 || info.Size() != expectedSize {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return nil
}

func matchesFileFingerprint(path string, sizeBytes int64, sha256Hex string) bool {
	info, err := os.Stat(path)
	if err != nil || info.Size() != sizeBytes {
		return false
	}
	if strings.TrimSpace(sha256Hex) == "" {
		return true
	}
	hash, err := hashFile(path)
	if err != nil {
		return false
	}
	return strings.EqualFold(hash, sha256Hex)
}

func hashFile(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func copyFile(sourcePath, destPath string) error {
	src, err := os.Open(sourcePath)
	if err != nil {
		return err
	}
	defer src.Close()

	if err := os.MkdirAll(filepath.Dir(destPath), os.ModePerm); err != nil {
		return err
	}

	dest, err := os.Create(destPath)
	if err != nil {
		return err
	}

	if _, err := io.Copy(dest, src); err != nil {
		dest.Close()
		return err
	}
	return dest.Close()
}

func resolveDownloadURL(baseURL, rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", fmt.Errorf("missing download URL")
	}
	if strings.HasPrefix(trimmed, "http://") || strings.HasPrefix(trimmed, "https://") {
		return trimmed, nil
	}
	base := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if base == "" {
		return "", fmt.Errorf("missing server base URL")
	}
	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}
	return base + trimmed, nil
}

func reportLog(logger DeploymentLogger, deployment RequiredFileDeployment, status, output string) {
	if logger == nil {
		return
	}
	if err := logger(deployment.ID, deployment.FileID, deployment.OriginalName, status, output); err != nil {
		log.Printf("file deploy log failed id=%d: %v", deployment.ID, err)
	}
}
