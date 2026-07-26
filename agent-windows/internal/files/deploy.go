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
	"syscall"
	"github.com/hmdm/agent-windows/internal/brand"
)

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
	state, err := LoadFilesState()
	if err != nil {
		log.Printf("file state load failed: %v", err)
		state = newEmptyFilesState()
	}

	stateChanged := false
	for _, deployment := range deployments {
		if state.ShouldSkipDeploy(deployment.ID, deployment.UpdatedAt) {
			log.Printf("file deploy: skip id=%d destination=%q (already deployed)", deployment.ID, deployment.DestinationPath)
			reportLog(opts.Logger, deployment, "Success", "Already deployed")
			continue
		}

		output, deployErr := deployOne(deployment, opts)
		if deployErr != nil {
			log.Printf("file deploy failed id=%d file_id=%d: %v", deployment.ID, deployment.FileID, deployErr)
			reportLog(opts.Logger, deployment, "Failed", output)
			state.MarkDeployFailed(deployment.ID, deployment.UpdatedAt)
			stateChanged = true
			continue
		}

		reportLog(opts.Logger, deployment, "Success", output)
		state.MarkDeployed(deployment.ID, deployment.UpdatedAt)
		stateChanged = true
	}

	if stateChanged {
		if err := SaveFilesState(state); err != nil {
			log.Printf("file state save failed: %v", err)
		}
	}
}

func deployOne(deployment RequiredFileDeployment, opts DeployOptions) (string, error) {
	reportLog(opts.Logger, deployment, "Downloading", fmt.Sprintf("Downloading %q", deployment.OriginalName))

	downloadURL, err := resolveDownloadURL(opts.BaseURL, deployment.DownloadURL)
	if err != nil {
		return "", err
	}

	localPath, err := ensureCachedFile(deployment, downloadURL)
	if err != nil {
		return "", fmt.Errorf("download file: %w", err)
	}

	destination := strings.TrimSpace(deployment.DestinationPath)
	if destination == "" {
		return "", fmt.Errorf("destination_path is empty")
	}

	reportLog(opts.Logger, deployment, "Installing", fmt.Sprintf("Deploying to %s", destination))

	if deployment.Unzip {
		if err := os.MkdirAll(destination, 0o755); err != nil {
			return "", fmt.Errorf("create destination directory: %w", err)
		}
		if err := extractZipArchive(localPath, destination); err != nil {
			return "", fmt.Errorf("extract archive: %w", err)
		}
	} else {
		if err := copyFileToDestination(localPath, destination, deployment.OriginalName); err != nil {
			return "", fmt.Errorf("copy file: %w", err)
		}
	}

	script := strings.TrimSpace(deployment.PostActionScript)
	if script == "" {
		return fmt.Sprintf("Deployed %q to %s", deployment.OriginalName, destination), nil
	}

	reportLog(opts.Logger, deployment, "Installing", fmt.Sprintf("Running post-action script: %s", script))
	output, err := runPostActionScript(destination, script)
	if err != nil {
		return output, fmt.Errorf("post-action script: %w", err)
	}

	message := fmt.Sprintf("Deployed %q to %s", deployment.OriginalName, destination)
	if output != "" {
		message += "\n" + output
	}
	return message, nil
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

func ensureCachedFile(deployment RequiredFileDeployment, downloadURL string) (string, error) {
	cacheDir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return "", err
	}
	cacheRoot := filepath.Join(cacheDir, "file_cache")
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return "", err
	}

	cacheName := fmt.Sprintf("%d_%s%s", deployment.FileID, deployment.SHA256, filepath.Ext(deployment.OriginalName))
	cachePath := filepath.Join(cacheRoot, cacheName)

	if matchesFileFingerprint(cachePath, deployment.SizeBytes, deployment.SHA256) {
		return cachePath, nil
	}

	partialPath := partialDownloadPath(cachePath)
	if err := downloadFileResumable(downloadURL, partialPath); err != nil {
		return "", err
	}

	if !matchesFileFingerprint(partialPath, deployment.SizeBytes, deployment.SHA256) {
		return "", fmt.Errorf("downloaded file fingerprint mismatch")
	}

	if err := os.Remove(cachePath); err != nil && !os.IsNotExist(err) {
		return "", err
	}
	if err := os.Rename(partialPath, cachePath); err != nil {
		return "", err
	}
	return cachePath, nil
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
