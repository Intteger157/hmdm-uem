//go:build windows

package policies

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hmdm/agent-windows/internal/apps"
	"github.com/hmdm/agent-windows/internal/files"
)

const provisioningStateFileName = "provisioning-state.json"

// ProvisioningState remembers that this enrollment already reported completion,
// so the handover to the post-enrollment profile is signaled exactly once.
type ProvisioningState struct {
	SignaledAt string `json:"signaledAt,omitempty"`
	ProfileID  uint   `json:"profileId,omitempty"`
}

// ProvisioningReadiness describes whether the initial provisioning phase settled.
type ProvisioningReadiness struct {
	Settled bool
	Reason  string
}

func provisioningStateFilePath() string {
	return filepath.Join(policyDirectory(), provisioningStateFileName)
}

func LoadProvisioningState() (ProvisioningState, error) {
	data, err := os.ReadFile(provisioningStateFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return ProvisioningState{}, nil
		}
		return ProvisioningState{}, fmt.Errorf("read provisioning-state.json: %w", err)
	}

	var state ProvisioningState
	if err := json.Unmarshal(data, &state); err != nil {
		return ProvisioningState{}, fmt.Errorf("decode provisioning-state.json: %w", err)
	}
	return state, nil
}

// ProvisioningCompletionSignaled reports whether this enrollment already told the
// server that provisioning finished.
func ProvisioningCompletionSignaled() bool {
	state, err := LoadProvisioningState()
	if err != nil {
		return false
	}
	return state.SignaledAt != ""
}

// MarkProvisioningCompletionSignaled records the completion signal so it is not repeated.
func MarkProvisioningCompletionSignaled(profileID uint) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(ProvisioningState{
		SignaledAt: time.Now().UTC().Format(time.RFC3339),
		ProfileID:  profileID,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal provisioning state: %w", err)
	}
	if err := os.WriteFile(provisioningStateFilePath(), payload, 0o644); err != nil {
		return fmt.Errorf("write provisioning-state.json: %w", err)
	}
	return nil
}

// ClearProvisioningState re-arms the handover, e.g. after a fresh enrollment.
func ClearProvisioningState() error {
	if err := os.Remove(provisioningStateFilePath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove provisioning-state.json: %w", err)
	}
	return nil
}

// EvaluateProvisioningReadiness reports whether every pipeline of the assigned
// configuration is applied: policy payload, registry policies, required apps and
// file deployment rules. A failed or pending item keeps the device in its
// enrollment configuration on purpose.
func EvaluateProvisioningReadiness() ProvisioningReadiness {
	config, err := LoadDesiredConfig()
	if err != nil {
		return ProvisioningReadiness{Reason: fmt.Sprintf("cached configuration unavailable: %v", err)}
	}
	if !config.HasAssignedPolicy() {
		return ProvisioningReadiness{Reason: "no configuration assigned"}
	}

	if ConfigHash(config) != LoadLastSyncedConfigHash() {
		return ProvisioningReadiness{Reason: "policy payload not applied yet"}
	}

	registry, err := LoadDesiredRegistryPolicies()
	if err != nil {
		return ProvisioningReadiness{Reason: fmt.Sprintf("cached registry policies unavailable: %v", err)}
	}
	if RegistryPoliciesHash(registry) != LoadLastSyncedRegistryHash() {
		return ProvisioningReadiness{Reason: "registry policies not applied yet"}
	}

	if apps.DeploymentInProgress() {
		return ProvisioningReadiness{Reason: "app deployment in progress"}
	}
	if !apps.AllRequiredAppsSettled(config.RequiredApps) {
		return ProvisioningReadiness{Reason: "required apps not deployed yet"}
	}

	if files.DeploymentInProgress() {
		return ProvisioningReadiness{Reason: "file deployment in progress"}
	}
	if !files.AllDeploymentsSettled(config.FileDeployments) {
		return ProvisioningReadiness{Reason: "file deployments not applied yet"}
	}

	return ProvisioningReadiness{Settled: true, Reason: "all policies applied"}
}

// AssignedProfileID returns the configuration currently cached on this device.
func AssignedProfileID() uint {
	config, err := LoadDesiredConfig()
	if err != nil {
		return 0
	}
	return config.ProfileID
}
