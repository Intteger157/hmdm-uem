//go:build windows

package policies

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const policyDirectory = `C:\ProgramData\HMDM\Agent`

var (
	configFilePath  = filepath.Join(policyDirectory, "config.json")
	appliedFilePath = filepath.Join(policyDirectory, "applied-policy.json")
)

func SaveDesiredConfig(config EffectiveConfig) error {
	if err := ensurePolicyDirectory(); err != nil {
		return err
	}

	config.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	payload, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal desired config: %w", err)
	}

	if err := os.WriteFile(configFilePath, payload, 0o644); err != nil {
		return fmt.Errorf("write config.json: %w", err)
	}
	return nil
}

func LoadDesiredConfig() (EffectiveConfig, error) {
	data, err := os.ReadFile(configFilePath)
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
	if err := os.WriteFile(appliedFilePath, data, 0o644); err != nil {
		return fmt.Errorf("write applied-policy.json: %w", err)
	}
	return nil
}

func LoadAppliedPolicy() (AppliedPolicy, error) {
	data, err := os.ReadFile(appliedFilePath)
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

func ensurePolicyDirectory() error {
	if err := os.MkdirAll(policyDirectory, 0o755); err != nil {
		return fmt.Errorf("create policy directory: %w", err)
	}
	return nil
}
