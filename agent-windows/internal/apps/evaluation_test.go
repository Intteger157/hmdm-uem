//go:build windows

package apps

import (
	"testing"

	"github.com/hmdm/agent-windows/internal/system"
)

func TestEvaluateRequiredAppAlreadyInstalled(t *testing.T) {
	t.Parallel()

	app := RequiredApp{ID: 1, Name: "Example App", Version: "1.0.0"}
	installed := []system.InstalledSoftwareInfo{{Name: "Example App", Version: "1.0.0"}}
	line := EvaluateRequiredApp(app, newEmptyAppsState(), installed)
	if line != "- App [Example App]: Already installed" {
		t.Fatalf("EvaluateRequiredApp() = %q", line)
	}
}

func TestEvaluateRequiredAppQueued(t *testing.T) {
	t.Parallel()

	app := RequiredApp{ID: 2, Name: "Missing App", Version: "2.0.0"}
	line := EvaluateRequiredApp(app, newEmptyAppsState(), nil)
	if line != "- App [Missing App]: Queued for installation" {
		t.Fatalf("EvaluateRequiredApp() = %q", line)
	}
}

func TestEvaluateRequiredAppAlreadyDeployed(t *testing.T) {
	t.Parallel()

	state := newEmptyAppsState()
	state.MarkDeployed(RequiredApp{ID: 3, Name: "Deployed App", UpdatedAt: "2026-07-27T10:00:00Z"})
	app := RequiredApp{ID: 3, Name: "Deployed App", UpdatedAt: "2026-07-27T10:00:00Z"}
	line := EvaluateRequiredApp(app, state, nil)
	if line != "- App [Deployed App]: Already deployed" {
		t.Fatalf("EvaluateRequiredApp() = %q", line)
	}
}
