//go:build windows

package policies

import "log"

func handleNoPolicyConfig(report Reporter) error {
	lastHash := LoadLastSyncedConfigHash()
	if IsEmptyPolicyHash(lastHash) {
		return nil
	}

	applied, err := LoadAppliedPolicy()
	if err != nil {
		return err
	}

	needsCleanup := applied.EnforcedAt != "" && !EqualPayload(applied.Payload, Payload{})

	if err := ClearPolicyCache(); err != nil {
		log.Printf("policy sync: failed to clear policy cache: %v", err)
	}

	if !needsCleanup {
		if err := SaveAppliedPolicy(Payload{}); err != nil {
			return err
		}
		if err := SaveLastReportedConfigHash(emptyPolicyHash); err != nil {
			return err
		}
		return nil
	}

	results := EnforcePolicies(Payload{})
	output, success := formatResults(results)
	if err := SaveAppliedPolicy(Payload{}); err != nil {
		log.Printf("policy sync: failed to save cleared applied policy: %v", err)
	}

	if report != nil {
		if err := report(success, output); err != nil {
			log.Printf("policy cleanup log upload failed: %v", err)
		}
	}
	if err := SaveLastReportedConfigHash(emptyPolicyHash); err != nil {
		return err
	}
	log.Printf("policy sync: no assigned profile; local restrictions cleared success=%v", success)
	return nil
}

func shouldReportConfigChange(configHash string) bool {
	return configHash != LoadLastReportedConfigHash()
}

func markConfigReported(configHash string) error {
	return SaveLastReportedConfigHash(configHash)
}
