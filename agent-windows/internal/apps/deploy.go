//go:build windows

package apps

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/hmdm/agent-windows/internal/system"
)

// RequiredApp is one application the agent must install.
type RequiredApp struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	InstallArgs string `json:"installArgs"`
}

const downloadTimeout = 15 * time.Minute

type StatusReporter func(appID uint, status, errMsg string) error

// DeployRequired installs missing required apps and reports progress to the server.
func DeployRequired(required []RequiredApp, reporter StatusReporter) {
	if len(required) == 0 {
		return
	}

	installed := system.CollectInstalledSoftware()
	for _, app := range required {
		if isAppInstalled(app.Name, app.Version, installed) {
			reportStatus(reporter, app.ID, "Success", "")
			continue
		}

		if err := installApp(app, reporter); err != nil {
			log.Printf("app deployment failed id=%d name=%q: %v", app.ID, app.Name, err)
			reportStatus(reporter, app.ID, "Failed", err.Error())
			continue
		}

		reportStatus(reporter, app.ID, "Success", "")
	}
}

func installApp(app RequiredApp, reporter StatusReporter) error {
	reportStatus(reporter, app.ID, "Downloading", "")

	localPath, err := downloadInstaller(app.DownloadURL)
	if err != nil {
		return fmt.Errorf("download: %w", err)
	}
	defer os.Remove(localPath)

	reportStatus(reporter, app.ID, "Installing", "")

	if err := runInstaller(localPath, app.InstallArgs); err != nil {
		return fmt.Errorf("install: %w", err)
	}
	return nil
}

func reportStatus(reporter StatusReporter, appID uint, status, errMsg string) {
	if reporter == nil {
		return
	}
	if err := reporter(appID, status, errMsg); err != nil {
		log.Printf("app status report failed id=%d status=%s: %v", appID, status, err)
	}
}

func isAppInstalled(name, version string, installed []system.InstalledSoftwareInfo) bool {
	targetName := strings.ToLower(strings.TrimSpace(name))
	if targetName == "" {
		return false
	}

	targetVersion := strings.TrimSpace(version)
	for _, item := range installed {
		itemName := strings.ToLower(strings.TrimSpace(item.Name))
		if itemName != targetName && !strings.Contains(itemName, targetName) {
			continue
		}
		if targetVersion == "" {
			return true
		}
		if strings.EqualFold(strings.TrimSpace(item.Version), targetVersion) {
			return true
		}
	}
	return false
}

func downloadInstaller(downloadURL string) (string, error) {
	client := &http.Client{Timeout: downloadTimeout}
	response, err := client.Get(downloadURL)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("HTTP %d", response.StatusCode)
	}

	ext := filepath.Ext(strings.Split(downloadURL, "?")[0])
	if ext == "" {
		ext = ".exe"
	}

	tempFile, err := os.CreateTemp("", "hmdm-app-*"+ext)
	if err != nil {
		return "", err
	}
	tempPath := tempFile.Name()

	if _, err := io.Copy(tempFile, response.Body); err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return "", err
	}
	if err := tempFile.Close(); err != nil {
		os.Remove(tempPath)
		return "", err
	}
	return tempPath, nil
}

func runInstaller(installerPath, installArgs string) error {
	args := strings.Fields(strings.TrimSpace(installArgs))
	ext := strings.ToLower(filepath.Ext(installerPath))

	var cmd *exec.Cmd
	switch ext {
	case ".msi":
		msiArgs := []string{"/i", installerPath, "/qn"}
		msiArgs = append(msiArgs, args...)
		cmd = exec.Command("msiexec", msiArgs...)
	default:
		cmd = exec.Command(installerPath, args...)
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		message := strings.TrimSpace(string(output))
		if message == "" {
			return err
		}
		return fmt.Errorf("%w: %s", err, message)
	}
	return nil
}
