//go:build windows

package apps

import (
	"strings"
	"testing"
)

func TestFormatPowerShellArgumentList(t *testing.T) {
	t.Parallel()

	got := formatPowerShellArgumentList([]string{"/S"})
	if got != "'/S'" {
		t.Fatalf("formatPowerShellArgumentList() = %q, want '/S'", got)
	}

	got = formatPowerShellArgumentList([]string{"/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"})
	want := "'/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'"
	if got != want {
		t.Fatalf("formatPowerShellArgumentList() = %q, want %q", got, want)
	}
}

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

	_, cmdLine := buildInstallerCommandWithArgs(`C:\Temp\setup.msi`, nil)
	if !strings.Contains(cmdLine, `msiexec.exe /i`) || !strings.Contains(cmdLine, "/quiet") {
		t.Fatalf("unexpected msi command line: %q", cmdLine)
	}
}

func TestBuildEXEInstallPowerShellDoesNotRedirectStreams(t *testing.T) {
	t.Parallel()

	script := buildEXEInstallPowerShell(`C:\Temp\setup.exe`, []string{"/S"})
	if strings.Contains(script, "RedirectStandardOutput") || strings.Contains(script, "RedirectStandardError") {
		t.Fatalf("installer script must not redirect streams: %q", script)
	}
	if !strings.Contains(script, "Start-Process -FilePath") {
		t.Fatalf("expected Start-Process -FilePath in script: %q", script)
	}
}
