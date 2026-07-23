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

	InstallStepAppCheck    = "AppCheck"
	InstallStepAppDownload = "AppDownload"
	InstallStepAppUnblock  = "AppUnblock"
	InstallStepAppInstall  = "AppInstall"
	InstallStepAppResult   = "AppResult"
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

type StatusReporter func(appID uint, appName, status, errMsg string) error

type StepLogger func(appID uint, appName, step, output string) error

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

func reportDeployFailure(opts DeployOptions, app RequiredApp, message string, err error) (bool, error) {
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppResult, message)
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Failed", message)
	if err != nil {
		return false, err
	}
	return false, fmt.Errorf("%s", message)
}

func deployWingetApp(app RequiredApp, opts DeployOptions, state *AppsState) (bool, error) {
	wingetID := strings.TrimSpace(app.WingetID)
	if wingetID == "" {
		return reportDeployFailure(opts, app, "missing wingetId", fmt.Errorf("missing wingetId"))
	}

	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppCheck, fmt.Sprintf("Checking winget package %q", wingetID))

	installed, err := isWingetInstalled(wingetID)
	if err != nil {
		return reportDeployFailure(opts, app, fmt.Sprintf("winget list failed: %v", err), fmt.Errorf("winget list: %w", err))
	}

	if !installed {
		reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppInstall, fmt.Sprintf("winget install --id %s --silent", wingetID))
		reportStatus(opts.StatusReporter, app.ID, app.Name, "Installing", "")
		if err := runWinget("install", "--id", wingetID); err != nil {
			return reportDeployFailure(opts, app, err.Error(), err)
		}
		reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppResult, "winget install completed successfully")
		reportStatus(opts.StatusReporter, app.ID, app.Name, "Success", "")
		state.MarkChecked(app.ID, time.Now().UTC())
		return true, nil
	}

	if !shouldCheckUpdate(app, state) {
		reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppCheck, fmt.Sprintf("Package %q already installed; update check skipped", wingetID))
		return false, nil
	}

	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppInstall, fmt.Sprintf("winget upgrade --id %s --silent", wingetID))
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Installing", "")
	if err := runWinget("upgrade", "--id", wingetID); err != nil {
		return reportDeployFailure(opts, app, err.Error(), err)
	}
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppResult, "winget upgrade completed successfully")
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Success", "")
	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func deployURLApp(app RequiredApp, opts DeployOptions, state *AppsState, installed []system.InstalledSoftwareInfo) (bool, error) {
	rawURL := strings.TrimSpace(app.DownloadURL)
	if rawURL == "" {
		return reportDeployFailure(opts, app, "missing downloadUrl", fmt.Errorf("missing downloadUrl"))
	}

	alreadyInstalled := isAppInstalled(app.Name, app.Version, installed)
	checkMessage := fmt.Sprintf(
		"Required app %q version=%q downloadUrl=%q alreadyInstalled=%v autoUpdate=%v",
		app.Name,
		strings.TrimSpace(app.Version),
		rawURL,
		alreadyInstalled,
		app.AutoUpdate,
	)
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppCheck, checkMessage)

	if alreadyInstalled && !shouldCheckUpdate(app, state) {
		reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppCheck, "App already installed; skipping deployment")
		return false, nil
	}

	resolvedURL, err := resolveDownloadURL(opts.BaseURL, rawURL)
	if err != nil {
		return reportDeployFailure(opts, app, fmt.Sprintf("resolve download URL: %v", err), fmt.Errorf("resolve download URL: %w", err))
	}

	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppDownload, fmt.Sprintf("Downloading from %s", resolvedURL))
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Downloading", "")

	localPath, err := downloadInstaller(resolvedURL)
	if err != nil {
		return reportDeployFailure(opts, app, fmt.Sprintf("download failed: %v", err), fmt.Errorf("download: %w", err))
	}
	defer os.Remove(localPath)

	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppDownload, fmt.Sprintf("Download completed: %s", localPath))

	if err := unblockDownloadedFile(localPath); err != nil {
		reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppUnblock, err.Error())
		return reportDeployFailure(opts, app, fmt.Sprintf("unblock file: %v", err), fmt.Errorf("unblock file: %w", err))
	}
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppUnblock, fmt.Sprintf("Unblock-File applied to %s", localPath))

	cmd, cmdLine := buildInstallerCommand(localPath, app.InstallArgs)
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppInstall, cmdLine)
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Installing", "")

	result, err := runPreparedInstaller(cmd)
	if err != nil {
		resultMessage := formatInstallResult(result)
		return reportDeployFailure(opts, app, resultMessage, fmt.Errorf("install: %w", err))
	}

	resultMessage := formatInstallResult(result)
	reportStep(opts.StepLogger, app.ID, app.Name, InstallStepAppResult, resultMessage)
	reportStatus(opts.StatusReporter, app.ID, app.Name, "Success", resultMessage)

	state.MarkChecked(app.ID, time.Now().UTC())
	return true, nil
}

func runPreparedInstaller(cmd *exec.Cmd) (installRunResult, error) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	exitCode := commandExitCode(cmd, err)

	result := installRunResult{ExitCode: exitCode, Output: message}
	if isInstallerSuccess(exitCode) {
		return result, nil
	}

	if err != nil && message == "" {
		return result, fmt.Errorf("installer failed with exit code %d: %w", exitCode, err)
	}
	if message == "" {
		return result, fmt.Errorf("installer failed with exit code %d", exitCode)
	}
	return result, fmt.Errorf("installer failed with exit code %d: %s", exitCode, message)
}

func formatInstallResult(result installRunResult) string {
	if result.Output == "" {
		return fmt.Sprintf("ExitCode=%d", result.ExitCode)
	}
	return fmt.Sprintf("ExitCode=%d Output=%s", result.ExitCode, result.Output)
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

func reportStatus(reporter StatusReporter, appID uint, appName, status, errMsg string) {
	if reporter == nil {
		return
	}
	if err := reporter(appID, appName, status, errMsg); err != nil {
		log.Printf("app status report failed id=%d status=%s: %v", appID, status, err)
	}
}

func reportStep(logger StepLogger, appID uint, appName, step, output string) {
	if logger == nil {
		return
	}
	if err := logger(appID, appName, step, output); err != nil {
		log.Printf("app install step log failed id=%d step=%s: %v", appID, step, err)
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

func unblockDownloadedFile(path string) error {
	escaped := strings.ReplaceAll(path, "'", "''")
	command := fmt.Sprintf("Unblock-File -LiteralPath '%s'", escaped)
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
