//go:build windows

package apps

import (
	"fmt"
	"testing"

	"github.com/hmdm/agent-windows/internal/system"
)

func TestBatchNeedsDownloadJitterSkipsCachedAndWinget(t *testing.T) {
	state := newEmptyAppsState()
	state.DeployedApps["1"] = "2026-07-25T10:00:00Z"

	required := []RequiredApp{
		{ID: 1, Name: "Cached", UpdatedAt: "2026-07-25T10:00:00Z", DownloadURL: "https://example.com/a.exe"},
		{ID: 2, Name: "Winget App", AppType: AppTypeWinget, WingetID: "Vendor.App"},
	}

	if batchNeedsDownloadJitter(required, state, nil) {
		t.Fatal("expected no jitter when all apps are skipped")
	}
}

func TestBatchNeedsDownloadJitterTrueForPendingDownload(t *testing.T) {
	required := []RequiredApp{
		{ID: 3, Name: "App", DownloadURL: "https://example.com/app.exe"},
	}

	if !batchNeedsDownloadJitter(required, newEmptyAppsState(), nil) {
		t.Fatal("expected batch jitter for pending URL download")
	}
}

func TestBatchNeedsDownloadJitterFalseForAlreadyInstalled(t *testing.T) {
	required := []RequiredApp{
		{ID: 4, Name: "Installed App", Version: "1.0", DownloadURL: "https://example.com/app.exe"},
	}
	installed := []system.InstalledSoftwareInfo{
		{Name: "Installed App", Version: "1.0"},
	}

	if batchNeedsDownloadJitter(required, newEmptyAppsState(), installed) {
		t.Fatal("expected no jitter when app is already installed and auto-update is disabled")
	}
}

func TestReconcileStaleInstallStatusesReportsFailed(t *testing.T) {
	var reports []struct {
		appID   uint
		appName string
		status  string
		errMsg  string
	}

	ReconcileStaleInstallStatuses(func(appID uint, appName, status, errMsg string) error {
		reports = append(reports, struct {
			appID   uint
			appName string
			status  string
			errMsg  string
		}{appID, appName, status, errMsg})
		return nil
	}, []DeviceAppStatusSnapshot{
		{AppID: 1, AppName: "A", Status: InstallStatusInstalling},
		{AppID: 2, AppName: "B", Status: InstallStatusSuccess},
		{AppID: 3, AppName: "C", Status: InstallStatusDownloading},
	})

	if len(reports) != 2 {
		t.Fatalf("expected 2 stale status reports, got %d", len(reports))
	}
	for _, report := range reports {
		if report.status != InstallStatusFailed {
			t.Fatalf("expected Failed status, got %q", report.status)
		}
		if report.errMsg != StaleInstallAbortMessage {
			t.Fatalf("unexpected error message: %q", report.errMsg)
		}
	}
}

func TestIsAppStillRequiredDefaultsTrueWithoutValidator(t *testing.T) {
	if !isAppStillRequired(DeployOptions{}, 42) {
		t.Fatal("expected deploy to proceed when validator is not configured")
	}
}

func TestIsAppStillRequiredUsesValidator(t *testing.T) {
	opts := DeployOptions{
		IsAppStillRequired: func(appID uint) bool {
			return appID == 7
		},
	}
	if !isAppStillRequired(opts, 7) {
		t.Fatal("expected app 7 to be required")
	}
	if isAppStillRequired(opts, 8) {
		t.Fatal("expected app 8 to be canceled")
	}
}

func TestFormatInstallFailureMessageUsesTimeoutStatus(t *testing.T) {
	message := formatInstallFailureMessage(fmt.Errorf("%s", InstallTimeoutStatusMessage), installRunResult{})
	if message != InstallTimeoutStatusMessage {
		t.Fatalf("expected timeout status message, got %q", message)
	}
}
