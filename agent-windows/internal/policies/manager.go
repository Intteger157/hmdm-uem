//go:build windows

package policies

import (
	"log"

	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/apps"
)

type Reporter func(success bool, output string) error

// SyncFromServer fetches effective policy, caches it locally, and enforces when changed.
func SyncFromServer(fetch func() (EffectiveConfig, error), report Reporter, deploy apps.StatusReporter) error {
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
	if applied {
		output, success := FormatResults(results)
		log.Printf("policy enforcement completed success=%v\n%s", success, output)
		if report != nil {
			if reportErr := report(success, output); reportErr != nil {
				log.Printf("policy enforcement log upload failed: %v", reportErr)
			}
		}
	}

	apps.DeployRequired(config.RequiredApps, deploy)
	return nil
}

// RunComplianceCheck verifies policy state against cached desired config and re-applies on drift.
func RunComplianceCheck(report Reporter, deploy apps.StatusReporter) error {
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
		apps.DeployRequired(config.RequiredApps, deploy)
		return nil
	}

	output, success := FormatResults(results)
	log.Printf("policy compliance reconciliation completed success=%v\n%s", success, output)
	if report != nil {
		if reportErr := report(success, output); reportErr != nil {
			log.Printf("policy compliance log upload failed: %v", reportErr)
		}
	}

	apps.DeployRequired(config.RequiredApps, deploy)
	return nil
}

// NewAppStatusReporter builds a callback that posts app deployment status to the MDM server.
func NewAppStatusReporter(client *api.APIClient, authToken, hardwareID string) apps.StatusReporter {
	if client == nil || authToken == "" || hardwareID == "" {
		return nil
	}
	return func(appID uint, status, errMsg string) error {
		return client.ReportAppStatus(authToken, hardwareID, appID, status, errMsg)
	}
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
