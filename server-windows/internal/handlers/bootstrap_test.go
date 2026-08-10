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
		"stopping existing processes to release file locks",
		"Stop-Process -Name \"singularity-agent\"",
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
	if strings.Contains(strings.ToUpper(script), "HMDM") {
		t.Fatal("expected bootstrap script to omit legacy HMDM references")
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
		`$AdminUsername = "Admin"`,
		`$AdminPassword = $RegisterResponse.admin_password`,
		`throw 'Registration failed: missing admin password.'`,
		`ConvertTo-SecureString $AdminPassword -AsPlainText -Force`,
		`New-LocalUser -Name $AdminUsername -Password $SecurePassword -Description "Singularity MDM Administrator"`,
		`Add-LocalGroupMember -Group "Administrators" -Member $AdminUsername`,
		`Set-LocalUser -Name $AdminUsername -PasswordNeverExpires $true`,
		"SkipMachineOOBE",
		"SkipUserOOBE",
		"shutdown /r /t 5",
	} {
		if !strings.Contains(script, snippet) {
			t.Fatalf("expected script to contain %q, got:\n%s", snippet, script)
		}
	}
	if strings.Contains(script, `AdminPassword = "P@ssw0rd!"`) {
		t.Fatal("expected provisioning block to read admin password from register response")
	}
	if strings.Contains(script, "Write-Host $AdminPassword") || strings.Contains(script, "Write-Output $AdminPassword") {
		t.Fatal("expected provisioning block to avoid logging admin password")
	}
	if strings.Contains(script, "net user ") {
		t.Fatal("expected provisioning block to use New-LocalUser instead of net user")
	}
	if strings.Contains(script, "net localgroup ") {
		t.Fatal("expected provisioning block to use Add-LocalGroupMember instead of net localgroup")
	}
	if strings.Contains(script, "wmic USERACCOUNT") {
		t.Fatal("expected provisioning block to use Set-LocalUser instead of wmic")
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
