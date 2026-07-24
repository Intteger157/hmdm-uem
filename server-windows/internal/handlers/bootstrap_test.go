package handlers

import (
	"strings"
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestBuildBootstrapScript(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"win-enroll-org-test",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
		nil,
	)

	for _, snippet := range []string{
		"C:\\Program Files\\SingularityMDM",
		"singularity-agent.exe",
		"https://test-dev-mdm.intteger.uk",
		"/storage/singularity-autopilot/singularity-agent.exe",
		"win-enroll-org-test",
		"New-Service",
		"Start-Service",
		"state.json",
		"ServerURL",
		"EnrollmentToken",
	} {
		if !strings.Contains(script, snippet) {
			t.Fatalf("expected script to contain %q, got:\n%s", snippet, script)
		}
	}

	if strings.Contains(script, "SkipMachineOOBE") {
		t.Fatal("expected provisioning block to be omitted when settings are disabled")
	}
}

func TestBuildBootstrapScriptWithProvisioning(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"win-enroll-org-test",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
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

func TestEscapePowerShellDoubleQuoted(t *testing.T) {
	got := escapePowerShellDoubleQuoted(`pass"word$`)
	want := "pass`\"word`$"
	if got != want {
		t.Fatalf("unexpected escape result: %q", got)
	}
}
