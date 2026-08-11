//go:build windows

package apps

import (
	"testing"

	"github.com/hmdm/agent-windows/internal/system"
)

func TestEvaluateInstallPresence(t *testing.T) {
	t.Parallel()

	installed := []system.InstalledSoftwareInfo{
		{Name: "Vendor Example App", Version: "2.1.0"},
		{Name: "Other Tool", Version: "9.0.0"},
	}

	if got := EvaluateInstallPresence("Missing", "1.0.0", installed); got != InstallMissing {
		t.Fatalf("missing = %v", got)
	}
	if got := EvaluateInstallPresence("Example App", "2.0.0", installed); got != InstallUpToDate {
		t.Fatalf("up to date = %v", got)
	}
	if got := EvaluateInstallPresence("Example App", "2.1.0", installed); got != InstallUpToDate {
		t.Fatalf("equal = %v", got)
	}
	if got := EvaluateInstallPresence("Example App", "3.0.0", installed); got != InstallOutdated {
		t.Fatalf("outdated = %v", got)
	}
	if got := EvaluateInstallPresence("Example App", "", installed); got != InstallUpToDate {
		t.Fatalf("empty expected = %v", got)
	}
}
