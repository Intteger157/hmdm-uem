//go:build windows

package policies

import (
	"log"

	"github.com/hmdm/agent-windows/internal/api"
)

type Reporter func(success bool, output string) error

// SyncFromServer fetches effective policy, caches it locally, and enforces when changed.
func SyncFromServer(fetch func() (EffectiveConfig, error), report Reporter) error {
	config, err := fetch()
	if err != nil {
		cached, cacheErr := LoadDesiredConfig()
		if cacheErr != nil || cached.UpdatedAt == "" {
			return err
		}
		log.Printf("policy sync: using cached config.json (%v)", err)
		config = cached
	} else if err := SaveDesiredConfig(config); err != nil {
		log.Printf("policy sync: failed to save config.json: %v", err)
	}

	results, applied, err := ApplyIfNeeded(config.Payload)
	if err != nil {
		output, _ := FormatResults(results)
		if report != nil {
			_ = report(false, output)
		}
		return err
	}
	if !applied {
		return nil
	}

	output, success := FormatResults(results)
	log.Printf("policy enforcement completed success=%v\n%s", success, output)
	if report != nil {
		if reportErr := report(success, output); reportErr != nil {
			log.Printf("policy enforcement log upload failed: %v", reportErr)
		}
	}
	return nil
}

// RunComplianceCheck verifies policy state against cached desired config and re-applies on drift.
func RunComplianceCheck(report Reporter) error {
	config, err := LoadDesiredConfig()
	if err != nil {
		return err
	}
	if config.UpdatedAt == "" {
		return nil
	}

	results, reconciled, err := ReconcileCompliance(config.Payload)
	if err != nil {
		output, _ := FormatResults(results)
		if report != nil {
			_ = report(false, output)
		}
		return err
	}
	if !reconciled {
		return nil
	}

	output, success := FormatResults(results)
	log.Printf("policy compliance reconciliation completed success=%v\n%s", success, output)
	if report != nil {
		if reportErr := report(success, output); reportErr != nil {
			log.Printf("policy compliance log upload failed: %v", reportErr)
		}
	}
	return nil
}

// NewReporter builds a callback that posts enforcement output to the MDM server.
func NewReporter(client *api.APIClient, authToken, hardwareID string) Reporter {
	if client == nil || authToken == "" || hardwareID == "" {
		return nil
	}
	return func(success bool, output string) error {
		return client.ReportPolicyEnforcement(authToken, hardwareID, success, output)
	}
}
