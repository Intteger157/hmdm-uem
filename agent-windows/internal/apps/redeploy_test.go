//go:build windows

package apps

import (
	"testing"

	"github.com/hmdm/agent-windows/internal/system"
)

func TestAppMissingLocally(t *testing.T) {
	t.Parallel()

	installed := []system.InstalledSoftwareInfo{
		{Name: "Vendor Example App", Version: "2.1.0"},
		{Name: "Other Tool", Version: "9.0.0"},
	}

	if !appMissingLocally(RequiredApp{ID: 1, Name: "Example App"}, []system.InstalledSoftwareInfo{{Name: "Other Tool"}}) {
		t.Fatal("uninstalled app must be reported as missing")
	}
	if appMissingLocally(RequiredApp{ID: 1, Name: "Example App"}, installed) {
		t.Fatal("installed app must not be reported as missing")
	}
	if appMissingLocally(RequiredApp{ID: 1, Name: "Example App"}, nil) {
		t.Fatal("empty inventory must not trigger a reinstall")
	}
	if appMissingLocally(RequiredApp{ID: 1, Name: "Example App", AppType: AppTypeWinget}, installed) {
		t.Fatal("winget apps are verified by winget itself")
	}
}

func TestCatalogRevisionChanged(t *testing.T) {
	t.Parallel()

	state := newEmptyAppsState()
	deployed := RequiredApp{ID: 7, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-01T10:00:00Z"}
	state.MarkDeployed(deployed)

	if catalogRevisionChanged(deployed, &state) {
		t.Fatal("same revision must not be treated as changed")
	}

	// Admin re-uploaded the installer keeping the same version string.
	sameVersionNewRevision := RequiredApp{ID: 7, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-05T10:00:00Z"}
	if !catalogRevisionChanged(sameVersionNewRevision, &state) {
		t.Fatal("new catalog revision must be deployed even with an identical version string")
	}

	neverDeployed := RequiredApp{ID: 8, Name: "Fresh App", Version: "1.0.0", UpdatedAt: "2026-08-05T10:00:00Z"}
	if catalogRevisionChanged(neverDeployed, &state) {
		t.Fatal("pre-existing software must stay skippable when the agent never deployed it")
	}
}

func TestDriftRepairIsAttemptedOncePerRevision(t *testing.T) {
	t.Parallel()

	state := newEmptyAppsState()
	app := RequiredApp{ID: 11, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-01T10:00:00Z"}

	if state.DriftRepairAttempted(app) {
		t.Fatal("fresh state must allow one drift repair")
	}
	state.MarkDriftRepairAttempted(app)
	if !state.DriftRepairAttempted(app) {
		t.Fatal("drift repair must be remembered for the same revision")
	}

	nextRevision := app
	nextRevision.UpdatedAt = "2026-08-05T10:00:00Z"
	if state.DriftRepairAttempted(nextRevision) {
		t.Fatal("a new revision must be allowed one drift repair again")
	}
}

func TestEvaluateRequiredAppRedeploysAfterLocalUninstall(t *testing.T) {
	t.Parallel()

	state := newEmptyAppsState()
	app := RequiredApp{ID: 9, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-01T10:00:00Z"}
	state.MarkDeployed(app)

	installed := []system.InstalledSoftwareInfo{{Name: "Other Tool", Version: "9.0.0"}}
	if line := EvaluateRequiredApp(app, state, installed); line != "- App [Example App]: Queued for installation" {
		t.Fatalf("EvaluateRequiredApp() = %q", line)
	}
}

func TestEvaluateRequiredAppNewRevisionOfInstalledApp(t *testing.T) {
	t.Parallel()

	state := newEmptyAppsState()
	state.MarkDeployed(RequiredApp{ID: 10, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-01T10:00:00Z"})

	app := RequiredApp{ID: 10, Name: "Example App", Version: "1.0.0", UpdatedAt: "2026-08-05T10:00:00Z"}
	installed := []system.InstalledSoftwareInfo{{Name: "Example App", Version: "1.0.0"}}
	want := "- App [Example App]: Queued for update (new installer revision)"
	if line := EvaluateRequiredApp(app, state, installed); line != want {
		t.Fatalf("EvaluateRequiredApp() = %q, want %q", line, want)
	}
}
