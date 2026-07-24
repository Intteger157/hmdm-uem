package handlers

import (
	"strings"
	"testing"
)

func TestBuildBootstrapScript(t *testing.T) {
	script := buildBootstrapScript(
		"https://test-dev-mdm.intteger.uk",
		"win-enroll-org-test",
		"https://test-dev-mdm.intteger.uk/storage/singularity-autopilot/singularity-agent.exe",
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
}
