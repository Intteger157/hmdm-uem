//go:build windows

package files

import (
	"strings"
	"testing"
)

func TestDeploymentFingerprintPrefersSHA256(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{
		ID:        7,
		FileID:    3,
		SHA256:    "ABC123",
		UpdatedAt: "2026-07-27T10:00:00Z",
	}
	if got := DeploymentFingerprint(deployment); got != "abc123@2026-07-27T10:00:00Z" {
		t.Fatalf("DeploymentFingerprint() = %q", got)
	}
}

func TestShouldSkipDeployUsesFingerprintAndAppliedFiles(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{
		ID:        9,
		FileID:    42,
		SHA256:    "deadbeef",
		UpdatedAt: "2026-07-27T10:00:00Z",
	}

	state := newEmptyFilesState()
	if state.ShouldSkipDeploy(deployment) {
		t.Fatal("expected deploy not to be skipped initially")
	}

	state.MarkDeployed(deployment)
	if !state.ShouldSkipDeploy(deployment) {
		t.Fatal("expected deploy to be skipped after MarkDeployed")
	}

	otherRuleSameFile := deployment
	otherRuleSameFile.ID = 99
	state.AppliedFiles = map[string]string{}
	state.DeployedRules = map[string]string{}
	state.AppliedFiles[appliedFileKey(deployment.FileID)] = "deadbeef"
	if !state.ShouldSkipDeploy(otherRuleSameFile) {
		t.Fatal("expected applied_files sha match to skip deploy")
	}
}

func TestShouldSkipDeploySupportsLegacyUpdatedAtValue(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{
		ID:        5,
		UpdatedAt: "2026-07-27T10:00:00Z",
	}
	state := newEmptyFilesState()
	state.DeployedRules[ruleKey(deployment.ID)] = deployment.UpdatedAt
	if !state.ShouldSkipDeploy(deployment) {
		t.Fatal("expected legacy updatedAt value to skip deploy")
	}
}

func TestMarkDeployedPersistsAppliedFiles(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{
		ID:        1,
		FileID:    10,
		SHA256:    "abc",
		UpdatedAt: "2026-07-27T10:00:00Z",
	}
	state := newEmptyFilesState()
	state.MarkDeployed(deployment)

	if state.DeployedRules[ruleKey(deployment.ID)] != DeploymentFingerprint(deployment) {
		t.Fatalf("DeployedRules = %#v", state.DeployedRules)
	}
	if state.AppliedFiles[appliedFileKey(deployment.FileID)] != "abc" {
		t.Fatalf("AppliedFiles = %#v", state.AppliedFiles)
	}
}

func TestShouldSkipDeployIgnoresEmptyFingerprintMatch(t *testing.T) {
	t.Parallel()

	deployment := RequiredFileDeployment{ID: 2, FileID: 3}
	state := newEmptyFilesState()
	state.DeployedRules[ruleKey(deployment.ID)] = ""
	if state.ShouldSkipDeploy(deployment) {
		t.Fatal("expected empty stored fingerprint not to skip")
	}
}

func TestAppliedFileKey(t *testing.T) {
	t.Parallel()

	if got := appliedFileKey(123); got != "123" {
		t.Fatalf("appliedFileKey() = %q", got)
	}
	if strings.TrimSpace(appliedFileKey(0)) != "0" {
		t.Fatalf("appliedFileKey(0) = %q", appliedFileKey(0))
	}
}
