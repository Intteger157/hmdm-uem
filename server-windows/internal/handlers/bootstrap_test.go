package handlers

import (
	"strings"
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestBuildBootstrapScriptTokenMode(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
		models.EnrollmentModeToken,
		"bootstrap-secret",
		nil,
	)

	for _, snippet := range []string{
		"C:\\Program Files\\Singularity MDM Agent",
		"C:\\ProgramData\\Singularity MDM Agent",
		"HKLM:\\SOFTWARE\\Singularity MDM\\Agent",
		"singularity-agent.exe",
		"https://test-dev-mdm.intteger.uk",
		"/storage/singularity-autopilot/singularity-agent.exe",
		"/api/windows/register",
		"$EnrollmentSecret = 'bootstrap-secret'",
		"enrollment_secret = $EnrollmentSecret",
		"enrollment_token = $EnrollmentToken",
		"New-Service",
		"Start-Service",
		"state.json",
	} {
		if !strings.Contains(script, snippet) {
			t.Fatalf("expected script to contain %q, got:\n%s", snippet, script)
		}
	}

	if strings.Contains(script, "Read-Host") {
		t.Fatal("expected token mode script to omit Read-Host prompt")
	}
	if strings.Contains(script, "SkipMachineOOBE") {
		t.Fatal("expected provisioning block to be omitted when settings are disabled")
	}
}

func TestBuildBootstrapScriptPasswordMode(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
		models.EnrollmentModePassword,
		"",
		nil,
	)

	if !strings.Contains(script, `Read-Host "Enter MDM Enrollment Password"`) {
		t.Fatalf("expected password mode prompt, got:\n%s", script)
	}
	if strings.Contains(script, "$EnrollmentSecret = '") {
		t.Fatal("expected password mode script to omit embedded secret")
	}
}

func TestBuildBootstrapScriptWithProvisioning(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
		models.EnrollmentModeToken,
		"bootstrap-secret",
		&models.WindowsEnrollmentProvisioningSettings{
			CreateLocalAdmin: true,
			AdminUsername:    "Admin",
			AdminPassword:    "P@ssw0rd!",
		},
	)

	for _, snippet := range []string{
		`net user "Admin" "P@ssw0rd!" /add`,
		`net localgroup Administrators "Admin" /add`,
		`wmic USERACCOUNT WHERE Name='Admin' SET PasswordExpires=FALSE`,
		"SkipMachineOOBE",
		"SkipUserOOBE",
		"shutdown /r /t 5",
	} {
		if !strings.Contains(script, snippet) {
			t.Fatalf("expected script to contain %q, got:\n%s", snippet, script)
		}
	}
}

func TestEnrollmentSecretsMismatch(t *testing.T) {
	if enrollmentSecretsMismatch("abc", "abc") {
		t.Fatal("expected matching secrets")
	}
	if !enrollmentSecretsMismatch("abc", "abd") {
		t.Fatal("expected mismatching secrets")
	}
	if !enrollmentSecretsMismatch("abc", "abcd") {
		t.Fatal("expected mismatch for different lengths")
	}
}

func TestEscapePowerShellDoubleQuoted(t *testing.T) {
	got := escapePowerShellDoubleQuoted(`pass"word$`)
	want := "pass`\"word`$"
	if got != want {
		t.Fatalf("unexpected escape result: %q", got)
	}
}

func TestEscapePowerShellSingleQuoted(t *testing.T) {
	got := escapePowerShellSingleQuoted(`it's`)
	want := "it''s"
	if got != want {
		t.Fatalf("unexpected escape result: %q", got)
	}
}
