//go:build windows

package policies

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"
)

// RegistryPolicy is one registry key-value policy from the server.
type RegistryPolicy struct {
	ID         uint   `json:"id,omitempty"`
	PolicyPath string `json:"policyPath"`
	ValueType  string `json:"valueType"`
	Value      string `json:"value"`
}

// RegistryPoliciesConfig is the merged registry policy set for one device.
type RegistryPoliciesConfig struct {
	ConfigurationID   uint             `json:"configurationId,omitempty"`
	ConfigurationName string           `json:"configurationName,omitempty"`
	Policies          []RegistryPolicy `json:"policies"`
	UpdatedAt         string           `json:"updatedAt,omitempty"`
}

func (c RegistryPoliciesConfig) HasPolicies() bool {
	return len(c.Policies) > 0 || c.ConfigurationID > 0 || strings.TrimSpace(c.ConfigurationName) != ""
}

// RegistryPoliciesHash returns a stable fingerprint for registry policy diffing.
func RegistryPoliciesHash(config RegistryPoliciesConfig) string {
	if len(config.Policies) == 0 {
		return "no-registry-policies"
	}

	type fingerprintPolicy struct {
		PolicyPath string `json:"policyPath"`
		ValueType  string `json:"valueType"`
		Value      string `json:"value"`
	}

	items := make([]fingerprintPolicy, 0, len(config.Policies))
	for _, policy := range config.Policies {
		items = append(items, fingerprintPolicy{
			PolicyPath: strings.TrimSpace(policy.PolicyPath),
			ValueType:  strings.ToUpper(strings.TrimSpace(policy.ValueType)),
			Value:      policy.Value,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return strings.ToUpper(items[i].PolicyPath) < strings.ToUpper(items[j].PolicyPath)
	})

	payload, err := json.Marshal(struct {
		ConfigurationID   uint                `json:"configurationId"`
		ConfigurationName string              `json:"configurationName"`
		Policies          []fingerprintPolicy `json:"policies"`
	}{
		ConfigurationID:   config.ConfigurationID,
		ConfigurationName: config.ConfigurationName,
		Policies:          items,
	})
	if err != nil {
		return ""
	}

	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

// SyncRegistryPoliciesFromServer fetches registry policies, caches them, and applies when changed.
func SyncRegistryPoliciesFromServer(fetch func() (RegistryPoliciesConfig, error), report Reporter) error {
	config, err := fetch()
	if err != nil {
		cached, cacheErr := LoadDesiredRegistryPolicies()
		if cacheErr != nil || !cached.HasPolicies() {
			return err
		}
		log.Printf("registry policy sync: using cached registry-policies.json (%v)", err)
		config = cached
	}

	if err := SaveDesiredRegistryPolicies(config); err != nil {
		log.Printf("registry policy sync: failed to save registry-policies.json: %v", err)
	}

	configHash := RegistryPoliciesHash(config)
	if configHash == LoadLastSyncedRegistryHash() {
		return nil
	}

	results, applied, applyErr := ApplyRegistryPoliciesIfNeeded(config.Policies)
	reportChange := shouldReportRegistryChange(configHash)
	if applyErr != nil {
		output, _ := FormatResults(results)
		log.Printf("registry policy enforcement failed: %s", output)
		if report != nil && reportChange {
			if reportErr := report(false, "Registry policies:\n"+output); reportErr != nil {
				log.Printf("registry policy enforcement log upload failed: %v", reportErr)
			}
			if markErr := markRegistryReported(configHash); markErr != nil {
				log.Printf("registry policy sync: failed to save reported hash: %v", markErr)
			}
		}
		return applyErr
	}

	if applied {
		output, success := FormatResults(results)
		log.Printf("registry policy enforcement completed success=%v\n%s", success, output)
		if report != nil && reportChange {
			if reportErr := report(success, "Registry policies:\n"+output); reportErr != nil {
				log.Printf("registry policy enforcement log upload failed: %v", reportErr)
			}
			if markErr := markRegistryReported(configHash); markErr != nil {
				log.Printf("registry policy sync: failed to save reported hash: %v", markErr)
			}
		}
	}

	if err := SaveLastSyncedRegistryHash(configHash); err != nil {
		log.Printf("registry policy sync: failed to save synced hash: %v", err)
	}

	return nil
}

// ApplyRegistryPoliciesIfNeeded applies registry policies when the hash changed.
func ApplyRegistryPoliciesIfNeeded(policies []RegistryPolicy) ([]Result, bool, error) {
	if len(policies) == 0 {
		return nil, false, nil
	}

	results := make([]Result, 0, len(policies))
	for _, policy := range policies {
		results = append(results, applyRegistryPolicy(policy))
	}

	output, success := formatResults(results)
	if !success {
		return results, true, fmt.Errorf("registry policy enforcement failed: %s", output)
	}

	applied := AppliedRegistryPolicies{
		Policies:   policies,
		EnforcedAt: time.Now().UTC().Format(time.RFC3339),
	}
	if err := SaveAppliedRegistryPolicies(applied); err != nil {
		return results, true, fmt.Errorf("save applied registry policies: %w", err)
	}

	return results, true, nil
}

func shouldReportRegistryChange(configHash string) bool {
	return configHash != LoadLastReportedRegistryHash()
}

func markRegistryReported(configHash string) error {
	return SaveLastReportedRegistryHash(configHash)
}
