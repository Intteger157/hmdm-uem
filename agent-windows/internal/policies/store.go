//go:build windows

package policies

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
)

func policyDirectory() string {
	dir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return brand.ProgramDataDir()
	}
	return dir
}

func configFilePath() string {
	return filepath.Join(policyDirectory(), "config.json")
}

func appliedFilePath() string {
	return filepath.Join(policyDirectory(), "applied-policy.json")
}

func syncStateFilePath() string {
	return filepath.Join(policyDirectory(), "config-sync-state.json")
}

func registryPoliciesFilePath() string {
	return filepath.Join(policyDirectory(), "registry-policies.json")
}

func appliedRegistryFilePath() string {
	return filepath.Join(policyDirectory(), "applied-registry-policies.json")
}

type syncState struct {
	LastSyncedHash           string `json:"lastSyncedHash,omitempty"`
	LastReportedHash         string `json:"lastReportedHash,omitempty"`
	LastSyncedRegistryHash   string `json:"lastSyncedRegistryHash,omitempty"`
	LastReportedRegistryHash string `json:"lastReportedRegistryHash,omitempty"`
}

func SaveDesiredConfig(config EffectiveConfig) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	payload, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal desired config: %w", err)
	}

	if err := os.WriteFile(configFilePath(), payload, 0o644); err != nil {
		return fmt.Errorf("write config.json: %w", err)
	}
	UpdateRequiredAppIDs(config.RequiredApps)
	return nil
}

func LoadDesiredConfig() (EffectiveConfig, error) {
	path := brand.ResolveDataPath("config.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return EffectiveConfig{}, nil
		}
		return EffectiveConfig{}, fmt.Errorf("read config.json: %w", err)
	}

	var config EffectiveConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return EffectiveConfig{}, fmt.Errorf("decode config.json: %w", err)
	}
	return config, nil
}

func SaveAppliedPolicy(payload Payload) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	applied := AppliedPolicy{
		Payload:    payload,
		EnforcedAt: time.Now().UTC().Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(applied, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal applied policy: %w", err)
	}
	if err := os.WriteFile(appliedFilePath(), data, 0o644); err != nil {
		return fmt.Errorf("write applied-policy.json: %w", err)
	}
	return nil
}

func LoadAppliedPolicy() (AppliedPolicy, error) {
	data, err := os.ReadFile(appliedFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return AppliedPolicy{}, nil
		}
		return AppliedPolicy{}, fmt.Errorf("read applied-policy.json: %w", err)
	}

	var applied AppliedPolicy
	if err := json.Unmarshal(data, &applied); err != nil {
		return AppliedPolicy{}, fmt.Errorf("decode applied-policy.json: %w", err)
	}
	return applied, nil
}

func LoadSyncState() (syncState, error) {
	data, err := os.ReadFile(syncStateFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return syncState{}, nil
		}
		return syncState{}, fmt.Errorf("read config-sync-state.json: %w", err)
	}

	var state syncState
	if err := json.Unmarshal(data, &state); err != nil {
		return syncState{}, fmt.Errorf("decode config-sync-state.json: %w", err)
	}
	return state, nil
}

func SaveSyncState(state syncState) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal config-sync-state: %w", err)
	}
	if err := os.WriteFile(syncStateFilePath(), payload, 0o644); err != nil {
		return fmt.Errorf("write config-sync-state.json: %w", err)
	}
	return nil
}

func LoadLastSyncedConfigHash() string {
	state, err := LoadSyncState()
	if err != nil {
		return ""
	}
	return state.LastSyncedHash
}

func LoadLastReportedConfigHash() string {
	state, err := LoadSyncState()
	if err != nil {
		return ""
	}
	return state.LastReportedHash
}

func SaveLastSyncedConfigHash(hash string) error {
	state, err := LoadSyncState()
	if err != nil {
		return err
	}
	state.LastSyncedHash = hash
	return SaveSyncState(state)
}

func SaveLastReportedConfigHash(hash string) error {
	state, err := LoadSyncState()
	if err != nil {
		return err
	}
	state.LastReportedHash = hash
	return SaveSyncState(state)
}

type AppliedRegistryPolicies struct {
	Policies   []RegistryPolicy `json:"policies"`
	EnforcedAt string           `json:"enforcedAt,omitempty"`
}

func SaveDesiredRegistryPolicies(config RegistryPoliciesConfig) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	payload, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal registry policies: %w", err)
	}

	if err := os.WriteFile(registryPoliciesFilePath(), payload, 0o644); err != nil {
		return fmt.Errorf("write registry-policies.json: %w", err)
	}
	return nil
}

func LoadDesiredRegistryPolicies() (RegistryPoliciesConfig, error) {
	data, err := os.ReadFile(registryPoliciesFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return RegistryPoliciesConfig{}, nil
		}
		return RegistryPoliciesConfig{}, fmt.Errorf("read registry-policies.json: %w", err)
	}

	var config RegistryPoliciesConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return RegistryPoliciesConfig{}, fmt.Errorf("decode registry-policies.json: %w", err)
	}
	return config, nil
}

func SaveAppliedRegistryPolicies(applied AppliedRegistryPolicies) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	data, err := json.MarshalIndent(applied, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal applied registry policies: %w", err)
	}
	if err := os.WriteFile(appliedRegistryFilePath(), data, 0o644); err != nil {
		return fmt.Errorf("write applied-registry-policies.json: %w", err)
	}
	return nil
}

func LoadLastSyncedRegistryHash() string {
	state, err := LoadSyncState()
	if err != nil {
		return ""
	}
	return state.LastSyncedRegistryHash
}

func LoadLastReportedRegistryHash() string {
	state, err := LoadSyncState()
	if err != nil {
		return ""
	}
	return state.LastReportedRegistryHash
}

func SaveLastSyncedRegistryHash(hash string) error {
	state, err := LoadSyncState()
	if err != nil {
		return err
	}
	state.LastSyncedRegistryHash = hash
	return SaveSyncState(state)
}

func SaveLastReportedRegistryHash(hash string) error {
	state, err := LoadSyncState()
	if err != nil {
		return err
	}
	state.LastReportedRegistryHash = hash
	return SaveSyncState(state)
}

// ClearDesiredConfig removes cached desired configuration from disk.
func ClearDesiredConfig() error {
	if err := os.Remove(configFilePath()); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove config.json: %w", err)
	}
	return nil
}

// ClearPolicyCache removes desired config and sync hashes while keeping applied-policy history.
func ClearPolicyCache() error {
	if err := ClearDesiredConfig(); err != nil {
		return err
	}
	UpdateRequiredAppIDs(nil)
	return SaveSyncState(syncState{LastSyncedHash: emptyPolicyHash})
}

func ensurePolicyDirectory() error {
	if _, err := brand.EnsureProgramDataDir(); err != nil {
		return fmt.Errorf("create policy directory: %w", err)
	}
	return nil
}
