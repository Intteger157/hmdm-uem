//go:build windows

package apps

import (
	"context"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
	"github.com/hmdm/agent-windows/internal/procexec"
	"github.com/hmdm/agent-windows/internal/system"
)

const (
	AppTypeUpload = "upload"
	AppTypeURL    = "url"
	AppTypeWinget = "winget"

	UpdateFrequencyDaily  = "daily"
	UpdateFrequencyWeekly = "weekly"

	downloadTimeout      = 2 * time.Hour
)

var (
	deployAppsMu      sync.Mutex
	deployBatchMu     sync.Mutex
	deployingAppIDs   = map[uint]bool{}
	deployingAppNames = map[string]bool{}
)

// RequiredApp is one application the agent must install or update.
type RequiredApp struct {
	ID              uint   `json:"id"`
	VersionID       uint   `json:"versionId,omitempty"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	UpdatedAt       string `json:"updatedAt"`
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
	BaseURL            string
	StatusReporter     StatusReporter
	StepLogger         StepLogger
	IsAppStillRequired func(appID uint) bool
}

// DeployRequiredAsync starts app deployment in a background goroutine so jitter,
// downloads, and installs never block the agent heartbeat loop.
func DeployRequiredAsync(required []RequiredApp, opts DeployOptions) {
	if len(required) == 0 {
		return
	}
	requiredCopy := append([]RequiredApp(nil), required...)
	go func() {
		log.Printf("app deploy: starting async deployment for %d app(s)", len(requiredCopy))
		DeployRequired(requiredCopy, opts)
	}()
}

// DeployRequired installs or updates required apps and reports progress to the server.
func DeployRequired(required []RequiredApp, opts DeployOptions) {
	if len(required) == 0 {
		return
	}
	deployBatchMu.Lock()
	defer deployBatchMu.Unlock()

	if opts.StatusReporter == nil {
		log.Printf("app deploy: status reporter not configured; server will keep Pending")
	}

	state, err := LoadAppsState()
	if err != nil {
		log.Printf("app state load failed: %v", err)
		state = newEmptyAppsState()
	}

	installed := system.CollectInstalledSoftware()
	if batchNeedsDownloadJitter(required, state, installed) {
		log.Printf("app deploy: applying batch jitter before processing %d app(s)", len(required))
		applyDownloadJitter()
	}

	stateChanged := false

	for _, app := range required {
		if !isAppStillRequired(opts, app.ID) {
			reportDeployCanceled(opts, app)
			continue
		}

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
	if !isAppStillRequired(opts, app.ID) {
		reportDeployCanceled(opts, app)
		return false, nil
	}

	if state.ShouldSkipDeploy(app) {
		log.Printf(
			"app deploy: skip id=%d name=%q fingerprint=%q (already deployed per local cache)",
			app.ID,
			app.Name,
			AppDeploymentFingerprint(app),
		)
		return false, nil
	}

	if !beginAppDeploy(app.ID, app.Name) {
		log.Printf("app deploy: skip id=%d name=%q, install already in progress on device", app.ID, app.Name)
		return false, nil
	}
	defer endAppDeploy(app.ID, app.Name)

	if state.FailedApps != nil {
		delete(state.FailedApps, appKey(app.ID))
	}

	appType := normalizeAppType(app.AppType)
	switch appType {
	case AppTypeWinget:
		return deployWingetApp(app, opts, state)
	default:
		return deployURLApp(app, opts, state, installed)
	}
}

func reportDeployFailure(opts DeployOptions, progress *InstallProgressReporter, app RequiredApp, state *AppsState, message string, err error) (bool, error) {
	if isInstallTimeout(err) {
		message = InstallTimeoutStatusMessage
		log.Printf("app deploy: execution timed out id=%d name=%q: %s", app.ID, app.Name, message)
	}

	if progress != nil {
		progress.Report(InstallStatusFailed, message)
	} else {
		reportInstallProgress(opts.StepLogger, app.ID, app.Name, InstallStatusFailed, message)
	}
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusFailed, message)
	if state != nil {
		state.MarkDeployFailed(app.ID, app.UpdatedAt)
	}
	if err != nil {
		return false, err
	}
	return false, fmt.Errorf("%s", message)
}

func isAppStillRequired(opts DeployOptions, appID uint) bool {
	if opts.IsAppStillRequired == nil {
		return true
	}
	return opts.IsAppStillRequired(appID)
}

func reportDeployCanceled(opts DeployOptions, app RequiredApp) {
	log.Printf(
		"app deploy: canceled id=%d name=%q (no longer required by configuration)",
		app.ID,
		app.Name,
	)
	reportInstallProgress(opts.StepLogger, app.ID, app.Name, InstallStatusCanceled, InstallCanceledMessage)
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusCanceled, InstallCanceledMessage)
}

func isInstallTimeout(err error) bool {
	if err == nil {
		return false
	}
	if procexec.IsTimeout(err) {
		return true
	}
	return strings.Contains(err.Error(), procexec.InstallTimeoutMessage) ||
		strings.Contains(err.Error(), InstallTimeoutStatusMessage)
}

func deployWingetApp(app RequiredApp, opts DeployOptions, state *AppsState) (bool, error) {
	wingetID := strings.TrimSpace(app.WingetID)
	progress := newInstallProgressReporter(opts.StepLogger, app.ID, app.Name)

	if wingetID == "" {
		return reportDeployFailure(opts, progress, app, state, "missing wingetId", fmt.Errorf("missing wingetId"))
	}

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Checking winget package %q", wingetID))

	installed, err := isWingetInstalled(wingetID)
	if err != nil {
		return reportDeployFailure(opts, progress, app, state, fmt.Sprintf("winget list failed: %v", err), fmt.Errorf("winget list: %w", err))
	}

	if !installed {
		if !isAppStillRequired(opts, app.ID) {
			reportDeployCanceled(opts, app)
			return false, nil
		}
		progress.Report(InstallStatusInstalling, fmt.Sprintf("Running: winget install --id %s --silent", wingetID))
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")
		output, err := runWingetOutput("install", "--id", wingetID)
		if err != nil {
			return reportDeployFailure(opts, progress, app, state, formatCommandFailure("winget install", output, err), err)
		}
		progress.Report(InstallStatusSuccess, output)
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "")
		state.MarkDeployed(app)
		return true, nil
	}

	if !shouldCheckUpdate(app, state) {
		progress.Report(InstallStatusSuccess, fmt.Sprintf("Package %q already installed; update check skipped", wingetID))
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "Already installed")
		state.MarkDeployed(app)
		return true, nil
	}

	if !isAppStillRequired(opts, app.ID) {
		reportDeployCanceled(opts, app)
		return false, nil
	}

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Running: winget upgrade --id %s --silent", wingetID))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")
	output, err := runWingetOutput("upgrade", "--id", wingetID)
	if err != nil {
		return reportDeployFailure(opts, progress, app, state, formatCommandFailure("winget upgrade", output, err), err)
	}
	progress.Report(InstallStatusSuccess, output)
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "")
	state.MarkDeployed(app)
	return true, nil
}

func deployURLApp(app RequiredApp, opts DeployOptions, state *AppsState, installed []system.InstalledSoftwareInfo) (bool, error) {
	rawURL := strings.TrimSpace(app.DownloadURL)
	progress := newInstallProgressReporter(opts.StepLogger, app.ID, app.Name)

	if rawURL == "" {
		return reportDeployFailure(opts, progress, app, state, "missing downloadUrl", fmt.Errorf("missing downloadUrl"))
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
		state.MarkDeployed(app)
		progress.Report(InstallStatusSuccess, "App already installed; skipping deployment")
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, "Already installed")
		return true, nil
	}

	resolvedURL, err := resolveDownloadURL(opts.BaseURL, rawURL)
	if err != nil {
		return reportDeployFailure(opts, progress, app, state, fmt.Sprintf("resolve download URL: %v", err), fmt.Errorf("resolve download URL: %w", err))
	}

	if !isAppStillRequired(opts, app.ID) {
		reportDeployCanceled(opts, app)
		return false, nil
	}

	progress.Report(InstallStatusDownloading, fmt.Sprintf("Download URL: %s", resolvedURL))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusDownloading, "")

	localPath, err := downloadInstaller(resolvedURL)
	if err != nil {
		return reportDeployFailure(opts, progress, app, state, fmt.Sprintf("download failed: %v", err), fmt.Errorf("download: %w", err))
	}
	selfUpdate := isAgentSelfUpdatePackage(app.Name)
	if !selfUpdate {
		defer os.Remove(localPath)
	}

	progress.note(fmt.Sprintf("Downloaded to %s", localPath))

	if err := unblockDownloadedFile(localPath); err != nil {
		return reportDeployFailure(opts, progress, app, state, fmt.Sprintf("Unblock-File failed: %v", err), fmt.Errorf("unblock file: %w", err))
	}
	progress.note("Unblock-File completed")

	if !isAppStillRequired(opts, app.ID) {
		reportDeployCanceled(opts, app)
		return false, nil
	}

	if selfUpdate {
		stagedPath, err := stageInstallerForDetachedRun(localPath)
		if err != nil {
			return reportDeployFailure(opts, progress, app, state, fmt.Sprintf("stage installer: %v", err), fmt.Errorf("stage installer: %w", err))
		}

		progress.Report(InstallStatusInstalling, fmt.Sprintf("Launching detached self-update: %s", stagedPath))
		log.Printf("app deploy: launching detached self-update id=%d name=%q path=%q installArgs=%q", app.ID, app.Name, stagedPath, app.InstallArgs)

		result, err := runDetachedURLInstaller(stagedPath, app.InstallArgs)
		if err != nil {
			os.Remove(stagedPath)
			log.Printf("app deploy: detached self-update failed id=%d name=%q: %v", app.ID, app.Name, err)
			return reportDeployFailure(opts, progress, app, state, formatInstallFailureMessage(err, result), fmt.Errorf("detached install: %w", err))
		}

		successMessage := "Agent self-update launched; service will restart"
		log.Printf("app deploy: detached self-update started id=%d name=%q", app.ID, app.Name)
		progress.Report(InstallStatusSuccess, result.Stdout)
		reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, successMessage)
		state.MarkDeployed(app)
		return true, nil
	}

	progress.Report(InstallStatusInstalling, fmt.Sprintf("Installer path: %s", localPath))
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusInstalling, "")

	if !isAppStillRequired(opts, app.ID) {
		reportDeployCanceled(opts, app)
		return false, nil
	}

	log.Printf("app deploy: installing id=%d name=%q path=%q installArgs=%q", app.ID, app.Name, localPath, app.InstallArgs)
	result, err := runURLInstaller(localPath, app.InstallArgs)
	if err != nil {
		log.Printf("app deploy: install failed id=%d name=%q: %v", app.ID, app.Name, err)
		resultMessage := formatInstallFailureMessage(err, result)
		return reportDeployFailure(opts, progress, app, state, resultMessage, fmt.Errorf("install: %w", err))
	}

	resultMessage := formatInstallResult(result)
	log.Printf("app deploy: install succeeded id=%d name=%q exitCode=%d", app.ID, app.Name, result.ExitCode)
	progress.Report(InstallStatusSuccess, resultMessage)
	reportStatus(opts.StatusReporter, app.ID, app.Name, InstallStatusSuccess, resultMessage)

	state.MarkDeployed(app)
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
		if isInstallTimeout(err) {
			b.WriteString("Error: ")
			b.WriteString(InstallTimeoutStatusMessage)
		} else {
			b.WriteString("Error: ")
			b.WriteString(err.Error())
		}
	}
	return strings.TrimSpace(b.String())
}

func formatInstallFailureMessage(err error, result installRunResult) string {
	if isInstallTimeout(err) {
		return InstallTimeoutStatusMessage
	}
	message := formatInstallResult(result)
	if message == "" && err != nil {
		message = err.Error()
	}
	return message
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

	ctx, cancel := context.WithTimeout(context.Background(), procexec.InstallTimeout)
	defer cancel()

	cmd := exec.Command("winget", fullArgs...)
	result, err := procexec.Run(ctx, cmd, true)
	message := strings.TrimSpace(strings.Join(filterCommandOutput(result.Stdout, result.Stderr), "\n"))
	if procexec.IsTimeout(err) {
		if message != "" {
			message += "\n"
		}
		message += procexec.InstallTimeoutMessage
		return message, fmt.Errorf("%s", procexec.InstallTimeoutMessage)
	}
	if err != nil {
		if message == "" {
			return message, err
		}
		return message, fmt.Errorf("%w: %s", err, message)
	}
	return message, nil
}

func filterCommandOutput(parts ...string) []string {
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
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
	request.Header.Set("User-Agent", brand.UserAgent)

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
	tempFile, err := os.CreateTemp("", brand.DownloadTempPrefix+"*"+ext)
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
	case "application/zip":
		return ".zip"
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

func beginAppDeploy(appID uint, appName string) bool {
	deployAppsMu.Lock()
	defer deployAppsMu.Unlock()

	normalizedName := normalizeDeployAppName(appName)
	if deployingAppIDs[appID] || (normalizedName != "" && deployingAppNames[normalizedName]) {
		return false
	}
	deployingAppIDs[appID] = true
	if normalizedName != "" {
		deployingAppNames[normalizedName] = true
	}
	return true
}

func endAppDeploy(appID uint, appName string) {
	deployAppsMu.Lock()
	defer deployAppsMu.Unlock()
	delete(deployingAppIDs, appID)
	if normalizedName := normalizeDeployAppName(appName); normalizedName != "" {
		delete(deployingAppNames, normalizedName)
	}
}

func normalizeDeployAppName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

func batchNeedsDownloadJitter(required []RequiredApp, state AppsState, installed []system.InstalledSoftwareInfo) bool {
	for _, app := range required {
		if state.ShouldSkipDeploy(app) {
			continue
		}
		if normalizeAppType(app.AppType) == AppTypeWinget {
			continue
		}
		if isAppInstalled(app.Name, app.Version, installed) && !shouldCheckUpdate(app, &state) {
			continue
		}
		if strings.TrimSpace(app.DownloadURL) != "" {
			return true
		}
	}
	return false
}

// StaleInstallAbortMessage is reported when in-flight installs are cleared on agent restart.
const StaleInstallAbortMessage = "Installation aborted due to agent restart"

// ReconcileStaleInstallStatuses marks interrupted downloads/installs as failed after service restart.
func ReconcileStaleInstallStatuses(reporter StatusReporter, statuses []DeviceAppStatusSnapshot) {
	if reporter == nil || len(statuses) == 0 {
		return
	}

	for _, item := range statuses {
		switch item.Status {
		case InstallStatusPending, InstallStatusInstalling, InstallStatusDownloading:
			log.Printf(
				"app deploy: clearing stale %q status for app id=%d name=%q",
				item.Status,
				item.AppID,
				item.AppName,
			)
			reportStatus(reporter, item.AppID, item.AppName, InstallStatusFailed, StaleInstallAbortMessage)
		}
	}
}

// DeviceAppStatusSnapshot is one app deployment status returned by the MDM server.
type DeviceAppStatusSnapshot struct {
	AppID   uint
	AppName string
	Status  string
}

func applyDownloadJitter() {
	const minDelaySec = 5
	const maxDelaySec = 120
	delaySec := minDelaySec + rand.Intn(maxDelaySec-minDelaySec+1)
	log.Printf(
		"Singularity MDM: Randomized delay applied to prevent server overload. Waiting %d seconds before download...",
		delaySec,
	)
	time.Sleep(time.Duration(delaySec) * time.Second)
}
