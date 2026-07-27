//go:build windows

package policies

import (
	"strings"
	"testing"

	"github.com/hmdm/agent-windows/internal/apps"
	"github.com/hmdm/agent-windows/internal/files"
)

func TestBuildConfigurationEvaluationReportNoAssignment(t *testing.T) {
	t.Parallel()

	report := BuildConfigurationEvaluationReport(EffectiveConfig{}, RegistryPoliciesConfig{})
	if !strings.Contains(report, evaluationReportHeader) {
		t.Fatalf("report missing header: %q", report)
	}
	if !strings.Contains(report, "No configuration profile assigned.") {
		t.Fatalf("report = %q", report)
	}
}

func TestBuildConfigurationEvaluationReportIncludesSections(t *testing.T) {
	t.Parallel()

	config := EffectiveConfig{
		ProfileName: "Lab Profile",
		Payload: Payload{
			RequireBitLocker: false,
		},
		RequiredApps: []apps.RequiredApp{
			{ID: 1, Name: "Demo App"},
		},
		FileDeployments: []files.RequiredFileDeployment{
			{ID: 2, FileID: 3, OriginalName: "payload.zip", SizeBytes: 128},
		},
	}

	report := BuildConfigurationEvaluationReport(config, RegistryPoliciesConfig{})
	for _, section := range []string{
		"Security Policies:",
		"Registry Policies:",
		"App Deployments:",
		"File Deployments:",
		"- App [Demo App]:",
		"- File [payload.zip]:",
	} {
		if !strings.Contains(report, section) {
			t.Fatalf("report missing %q: %s", section, report)
		}
	}
}

func TestPolicyEvaluationStatus(t *testing.T) {
	t.Parallel()

	if got := policyEvaluationStatus(Result{Name: "BitLocker", Success: true, Message: "compliant"}); got != "Already enforced" {
		t.Fatalf("policyEvaluationStatus() = %q", got)
	}
	if got := policyEvaluationStatus(Result{Name: "BitLocker", Success: false, Message: "drift"}); got != "Scheduled for enforcement" {
		t.Fatalf("policyEvaluationStatus() = %q", got)
	}
}
