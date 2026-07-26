//go:build windows

package apps

import (
	"strings"
	"testing"
)

func TestFormatInstallAttempts(t *testing.T) {
	t.Parallel()

	combined := formatInstallAttempts([]installRunResult{
		{CommandLine: `"app.exe" /S`, ExitCode: 2, Stderr: "failed /S"},
		{CommandLine: `"app.exe" /VERYSILENT`, ExitCode: 0, Stdout: "ok"},
	})

	if !strings.Contains(combined, "--- Next attempt ---") {
		t.Fatalf("expected attempt separator in %q", combined)
	}
	if !strings.Contains(combined, "failed /S") {
		t.Fatalf("expected first attempt output in %q", combined)
	}
}

func TestBuildInstallerCommandMSI(t *testing.T) {
	t.Parallel()

	_, _, cmdLine := buildInstallerCommandWithArgs(`C:\Temp\setup.msi`, nil)
	if !strings.Contains(cmdLine, `msiexec.exe /i`) || !strings.Contains(cmdLine, "/quiet") {
		t.Fatalf("unexpected msi command line: %q", cmdLine)
	}
}

func TestBuildInstallerCommandEXE(t *testing.T) {
	t.Parallel()

	_, _, cmdLine := buildInstallerCommandWithArgs(`C:\Temp\setup.exe`, nil)
	if !strings.Contains(cmdLine, `C:\Temp\setup.exe`) || !strings.Contains(cmdLine, "/S") {
		t.Fatalf("unexpected exe command line: %q", cmdLine)
	}
}

func TestNormalizeDeployAppName(t *testing.T) {
	t.Parallel()

	if got := normalizeDeployAppName("  Sloth Clash "); got != "sloth clash" {
		t.Fatalf("normalizeDeployAppName() = %q", got)
	}
}

func TestBeginAppDeployBlocksDuplicateName(t *testing.T) {
	deployAppsMu.Lock()
	deployingAppIDs = map[uint]bool{}
	deployingAppNames = map[string]bool{}
	deployAppsMu.Unlock()

	if !beginAppDeploy(1, "Sloth Clash") {
		t.Fatal("expected first deploy to begin")
	}
	if beginAppDeploy(2, "sloth clash") {
		t.Fatal("expected duplicate app name to be blocked")
	}
	if beginAppDeploy(1, "Other App") {
		t.Fatal("expected duplicate app id to be blocked")
	}

	endAppDeploy(1, "Sloth Clash")

	if !beginAppDeploy(2, "Sloth Clash") {
		t.Fatal("expected deploy to begin after previous finished")
	}
	endAppDeploy(2, "Sloth Clash")
}
