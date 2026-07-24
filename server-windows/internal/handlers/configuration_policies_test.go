package handlers

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestMergeConfigurationPoliciesRespectsProfileOrder(t *testing.T) {
	t.Parallel()

	profileIDs := []uint{1, 2}
	byProfile := map[uint][]models.ConfigurationPolicy{
		1: {
			{ProfileID: 1, PolicyPath: `HKLM\Software\Policies\Example\First`, ValueType: "DWORD", Value: "1"},
		},
		2: {
			{ProfileID: 2, PolicyPath: `HKLM\Software\Policies\Example\First`, ValueType: "DWORD", Value: "2"},
			{ProfileID: 2, PolicyPath: `HKLM\Software\Policies\Example\Second`, ValueType: "String", Value: "enabled"},
		},
	}

	merged := make(map[string]models.ConfigurationPolicyJSON)
	for _, profileID := range profileIDs {
		for _, policy := range byProfile[profileID] {
			key := policy.PolicyPath
			merged[key] = models.ToConfigurationPolicyJSON(policy)
		}
	}

	first := merged[`HKLM\Software\Policies\Example\First`]
	if first.Value != "2" {
		t.Fatalf("direct profile override failed: got value %q, want 2", first.Value)
	}
	if len(merged) != 2 {
		t.Fatalf("expected 2 merged policies, got %d", len(merged))
	}
}
