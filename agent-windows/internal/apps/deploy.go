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

const (
	AppTypeUpload = "upload"
	AppTypeURL    = "url"
	AppTypeWinget = "winget"

	UpdateFrequencyDaily  = "daily"
	UpdateFrequencyWeekly = "weekly"

	downloadTimeout = 15 * time.Minute
)

// RequiredApp is one application the agent must install or update.
type RequiredApp struct {
	ID              uint   `json:"id"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	DownloadURL     string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
}

type StatusReporter func(appID uint, status, errMsg string) error

// DeployRequired installs or updates required apps and reports progress to the server.
func DeployRequired(required []RequiredApp, reporter StatusReporter) {
	if len(required) == 0 {
		return
	}

	state, err := LoadAppsState()
	if err != nil {
		log.Printf("app state load failed: %v", err)
		state = AppsState{LastCheckTimes: map[string]string{}}
	}

	installed := system.CollectInstalledSoftware()
	stateChanged := false

	for _, app := range required {
		checked, deployErr := deployApp(app, &state, installed, reporter)
		if checked {
			stateChanged = true
		}
		if deployErr != nil {
			log.Printf("app deployment failed id=%d name=%q: %v", app.ID, app.Name, deployErr)
			reportStatus(reporter, app.ID, "Failed", deployErr.Error())
			continue
		}
		reportStatus(reporter, app.ID, "Success", "")
	}

	if stateChanged {
		if err := SaveAppsState(state); err != nil {
			log.Printf("app state save failed: %v", err)
		}
	}
}

func deployApp(app RequiredApp, state *AppsState, installed []system.InstalledSoftwareInfo, reporter StatusReporter) (checked bool, err error) {
	appType := normalizeAppType(app.AppType)
	switch appType {
	case AppTypeWinget:
		return deployWingetApp(app, state, reporter)
	default:
		return deployURLApp(app, state, installed, reporter)
	}
}

func deployWingetApp(app RequiredApp, state *AppsState, reporter StatusReporter) (bool, error) {
	wingetID := strings.TrimSpace(app.WingetID)
	if wingetID == "" {
		return false, fmt.Errorf("missing wingetId")
	}

	installed, err := isWingetInstalled(wingetID)
	if err != nil {
		return false, fmt.Errorf("winget list: %w", err)
	}

	if !installed {
		reportStatus(reporter, app.ID, "Installing", "")
		if err := runWinget("install", "--id", wingetID); err != nil {
			return false, err
		}
		state.MarkChecked(app.ID, time.Now().UTC())
		return true, nil
	}

	if !shouldCheckUpdate(app, state) {
		return false, nil
	}

	reportStatus(reporter, app.ID, "Installing", "")
	if err := runWinget("upgrade", "--id", wingetID); err != nil {
		return false, err
	}
	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func deployURLApp(app RequiredApp, state *AppsState, installed []system.InstalledSoftwareInfo, reporter StatusReporter) (bool, error) {
	downloadURL := strings.TrimSpace(app.DownloadURL)
	if downloadURL == "" {
		return false, fmt.Errorf("missing downloadUrl")
	}

	if isAppInstalled(app.Name, app.Version, installed) {
		if !shouldCheckUpdate(app, state) {
			return false, nil
		}
	}

	reportStatus(reporter, app.ID, "Downloading", "")
	localPath, err := downloadInstaller(downloadURL)
	if err != nil {
		return false, fmt.Errorf("download: %w", err)
	}
	defer os.Remove(localPath)

	reportStatus(reporter, app.ID, "Installing", "")
	if err := runInstaller(localPath, app.InstallArgs); err != nil {
		return false, fmt.Errorf("install: %w", err)
	}

	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func shouldCheckUpdate(app RequiredApp, state *AppsState) bool {
	if !app.AutoUpdate {
		return false
	}

	lastCheck := state.LastCheckTime(app.ID)
	if lastCheck.IsZero() {
		return true
	}

	interval := 24 * time.Hour
	if strings.EqualFold(strings.TrimSpace(app.UpdateFrequency), UpdateFrequencyWeekly) {
		interval = 7 * 24 * time.Hour
	}
	return time.Since(lastCheck) >= interval
}

func normalizeAppType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case AppTypeUpload:
		return AppTypeUpload
	case AppTypeWinget:
		return AppTypeWinget
	default:
		return AppTypeURL
	}
}

func isWingetInstalled(wingetID string) (bool, error) {
	output, err := runWingetOutput("list", "--id", wingetID)
	if err != nil {
		return false, err
	}
	needle := strings.ToLower(strings.TrimSpace(wingetID))
	body := strings.ToLower(output)
	return strings.Contains(body, needle), nil
}

func runWinget(args ...string) error {
	_, err := runWingetOutput(args...)
	return err
}

func runWingetOutput(args ...string) (string, error) {
	fullArgs := append(args, "--accept-package-agreements", "--accept-source-agreements")
	if len(args) > 0 && (args[0] == "install" || args[0] == "upgrade") {
		fullArgs = append(fullArgs, "--silent")
	}

	cmd := exec.Command("winget", fullArgs...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			return message, err
		}
		return message, fmt.Errorf("%w: %s", err, message)
	}
	return message, nil
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
