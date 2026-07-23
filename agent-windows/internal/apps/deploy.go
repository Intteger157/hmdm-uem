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
	"sync"
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

var deployGate sync.Mutex

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

type StatusReporter func(appID uint, appName, status, errMsg string) error

type StepLogger func(appID uint, appName, status, output string) error

// DeployOptions configures app deployment callbacks and server URL resolution.
type DeployOptions struct {
	BaseURL        string
	StatusReporter StatusReporter
	StepLogger     StepLogger
}

// DeployRequired installs or updates required apps and reports progress to the server.
func DeployRequired(required []RequiredApp, opts DeployOptions) {
	if len(required) == 0 {
		return
	}
	if !deployGate.TryLock() {
		log.Printf("app deploy: skipped, another deployment is already running")
		return
	}
	defer deployGate.Unlock()

	if opts.StatusReporter == nil {
		log.Printf("app deploy: status reporter not configured; server will keep Pending")
	}

	state, err := LoadAppsState()
	if err != nil {
		log.Printf("app state load failed: %v", err)
		state = AppsState{LastCheckTimes: map[string]string{}}
	}

	installed := system.CollectInstalledSoftware()
	stateChanged := false

	for _, app := range required {
		checked, deployErr := deployApp(app, opts, &state, installed)
		if checked {
			stateChanged = true
		}
		if deployErr != nil {
			log.Printf("app deployment failed id=%d name=%q: %v", app.ID, app.Name, deployErr)
			continue
		}
	}

	if stateChanged {
		if err := SaveAppsState(state); err != nil {
			log.Printf("app state save failed: %v", err)
		}
	}
}

func deployApp(app RequiredApp, opts DeployOptions, state *AppsState, installed []system.InstalledSoftwareInfo) (checked bool, err error) {
	appType := normalizeAppType(app.AppType)
	switch appType {
	case AppTypeWinget:
		return deployWingetApp(app, opts, state)
	default:
		return deployURLApp(app, opts, state, installed)
	}
}

func reportDeployFailure(opts DeployOptions, progress *InstallProgressReporter, app RequiredApp, message string, err error) (bool, error) {
	if progress != nil {
		progress.Report(InstallStatusFailed, message)
	} else {
		reportInstallProgress(opts.StepLogger, app.ID, app.Name, InstallStatusFailed, message)
	}
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusFailed, message)
	if err != nil {
		return false, err
	}
	return false, fmt.Errorf("%s", message)
}

func deployWingetApp(app RequiredApp, opts DeployOptions, state *AppsState) (bool, error) {
	wingetID := strings.TrimSpace(app.WingetID)
	progress := newInstallProgressReporter(opts.StepLogger, app.ID, app.Name)

	if wingetID == "" {
		return reportDeployFailure(opts, progress, app, "missing wingetId", fmt.Errorf("missing wingetId"))
	}

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Checking winget package %q", wingetID))

	installed, err := isWingetInstalled(wingetID)
	if err != nil {
		return reportDeployFailure(opts, progress, app, fmt.Sprintf("winget list failed: %v", err), fmt.Errorf("winget list: %w", err))
	}

	if !installed {
		progress.Report(InstallStatusInstalling, fmt.Sprintf("Running: winget install --id %s --silent", wingetID))
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")
		output, err := runWingetOutput("install", "--id", wingetID)
		if err != nil {
			return reportDeployFailure(opts, progress, app, formatCommandFailure("winget install", output, err), err)
		}
		progress.Report(InstallStatusSuccess, output)
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "")
		state.MarkChecked(app.ID, time.Now().UTC())
		return true, nil
	}

	if !shouldCheckUpdate(app, state) {
		progress.Report(InstallStatusSuccess, fmt.Sprintf("Package %q already installed; update check skipped", wingetID))
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "Already installed")
		return false, nil
	}

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Running: winget upgrade --id %s --silent", wingetID))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")
	output, err := runWingetOutput("upgrade", "--id", wingetID)
	if err != nil {
		return reportDeployFailure(opts, progress, app, formatCommandFailure("winget upgrade", output, err), err)
	}
	progress.Report(InstallStatusSuccess, output)
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "")
	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func deployURLApp(app RequiredApp, opts DeployOptions, state *AppsState, installed []system.InstalledSoftwareInfo) (bool, error) {
	rawURL := strings.TrimSpace(app.DownloadURL)
	progress := newInstallProgressReporter(opts.StepLogger, app.ID, app.Name)

	if rawURL == "" {
		return reportDeployFailure(opts, progress, app, "missing downloadUrl", fmt.Errorf("missing downloadUrl"))
	}

	alreadyInstalled := isAppInstalled(app.Name, app.Version, installed)
	progress.Report(
		InstallStatusDownloading,
		fmt.Sprintf(
			"Checking app %q version=%q alreadyInstalled=%v autoUpdate=%v",
			app.Name,
			strings.TrimSpace(app.Version),
			alreadyInstalled,
			app.AutoUpdate,
		),
	)

	if alreadyInstalled && !shouldCheckUpdate(app, state) {
		progress.Report(InstallStatusSuccess, "App already installed; skipping deployment")
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "Already installed")
		return false, nil
	}

	resolvedURL, err := resolveDownloadURL(opts.BaseURL, rawURL)
	if err != nil {
		return reportDeployFailure(opts, progress, app, fmt.Sprintf("resolve download URL: %v", err), fmt.Errorf("resolve download URL: %w", err))
	}

	progress.Report(InstallStatusDownloading, fmt.Sprintf("Download URL: %s", resolvedURL))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusDownloading, "")

	localPath, err := downloadInstaller(resolvedURL)
	if err != nil {
		return reportDeployFailure(opts, progress, app, fmt.Sprintf("download failed: %v", err), fmt.Errorf("download: %w", err))
	}
	defer os.Remove(localPath)

	progress.note(fmt.Sprintf("Downloaded to %s", localPath))

	if err := unblockDownloadedFile(localPath); err != nil {
		return reportDeployFailure(opts, progress, app, fmt.Sprintf("Unblock-File failed: %v", err), fmt.Errorf("unblock file: %w", err))
	}
	progress.note("Unblock-File completed")

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Installer path: %s", localPath))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")

	log.Printf("app deploy: installing id=%d name=%q path=%q installArgs=%q", app.ID, app.Name, localPath, app.InstallArgs)
	result, err := runURLInstaller(localPath, app.InstallArgs)
	if err != nil {
		log.Printf("app deploy: install failed id=%d name=%q: %v", app.ID, app.Name, err)
		resultMessage := formatInstallResult(result)
		if resultMessage == "" {
			resultMessage = err.Error()
		}
		return reportDeployFailure(opts, progress, app, resultMessage, fmt.Errorf("install: %w", err))
	}

	resultMessage := formatInstallResult(result)
	log.Printf("app deploy: install succeeded id=%d name=%q exitCode=%d", app.ID, app.Name, result.ExitCode)
	progress.Report(InstallStatusSuccess, resultMessage)
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, resultMessage)

	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func formatCommandFailure(command, output string, err error) string {
	var b strings.Builder
	b.WriteString(command)
	b.WriteString(" failed\n")
	if output != "" {
		b.WriteString("Output:\n")
		b.WriteString(output)
		b.WriteString("\n")
	}
	if err != nil {
		b.WriteString("Error: ")
		b.WriteString(err.Error())
	}
	return strings.TrimSpace(b.String())
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

func reportStatus(reporter StatusReporter, appID uint, appName, status, errMsg string) {
	if reporter == nil {
		return
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if err := reporter(appID, appName, status, errMsg); err == nil {
			return
		} else {
			lastErr = err
			if attempt < 2 {
				time.Sleep(time.Duration(attempt+1) * time.Second)
			}
		}
	}
	log.Printf("app status report failed id=%d status=%s: %v", appID, status, lastErr)
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

	request, err := http.NewRequest(http.MethodGet, downloadURL, nil)
	if err != nil {
		return "", err
	}
	request.Header.Set("User-Agent", "HMDM-Windows-Agent/1.0")

	response, err := client.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		message := strings.TrimSpace(string(body))
		if message == "" {
			return "", fmt.Errorf("HTTP %d", response.StatusCode)
		}
		return "", fmt.Errorf("HTTP %d: %s", response.StatusCode, message)
	}

	ext := installerExtension(downloadURL, response.Header.Get("Content-Type"))
	tempFile, err := os.CreateTemp("", "hmdm-app-*"+ext)
	if err != nil {
		return "", err
	}
	tempPath := tempFile.Name()

	written, err := io.Copy(tempFile, response.Body)
	if err != nil {
		tempFile.Close()
		os.Remove(tempPath)
		return "", err
	}
	if err := tempFile.Close(); err != nil {
		os.Remove(tempPath)
		return "", err
	}
	if written == 0 {
		os.Remove(tempPath)
		return "", fmt.Errorf("downloaded file is empty")
	}
	return tempPath, nil
}

func installerExtension(downloadURL, contentType string) string {
	if ext := filepath.Ext(strings.Split(downloadURL, "?")[0]); ext != "" {
		return ext
	}

	switch strings.ToLower(strings.TrimSpace(contentType)) {
	case "application/x-msi", "application/x-msdownload":
		return ".msi"
	default:
		return ".exe"
	}
}

func unblockDownloadedFile(path string) error {
	escaped := strings.ReplaceAll(path, "'", "''")
	command := fmt.Sprintf("Unblock-File -Path '%s'", escaped)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command)
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
