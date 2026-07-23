package policies

import (
	"log"

	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/apps"
)

type Reporter func(success bool, output string) error

// SyncFromServer fetches effective policy, caches it locally, and enforces when changed.
func SyncFromServer(fetch func() (EffectiveConfig, error), report Reporter, deploy apps.DeployOptions) error {
	config, err := fetch()
	if err != nil {
		cached, cacheErr := LoadDesiredConfig()
		if cacheErr != nil || cached.UpdatedAt == "" {
			return err
		}
		log.Printf("policy sync: using cached config.json (%v)", err)
		config = cached
	}

	if !config.HasAssignedPolicy() {
		return handleNoPolicyConfig(report)
	}

	if err := SaveDesiredConfig(config); err != nil {
		log.Printf("policy sync: failed to save config.json: %v", err)
	}

	if len(config.RequiredApps) > 0 {
		log.Printf("app deploy: processing %d required app(s)", len(config.RequiredApps))
		apps.DeployRequired(config.RequiredApps, deploy)
	}

	configHash := ConfigHash(config)
	if configHash == LoadLastSyncedConfigHash() {
		return nil
	}

	results, applied, err := ApplyIfNeeded(config.Payload)
	reportChange := shouldReportConfigChange(configHash)
	if err != nil {
		output, _ := FormatResults(results)
		log.Printf("policy enforcement failed: %s", output)
		if report != nil && reportChange {
			if reportErr := report(false, output); reportErr != nil {
				log.Printf("policy enforcement log upload failed: %v", reportErr)
			}
			if markErr := markConfigReported(configHash); markErr != nil {
				log.Printf("policy sync: failed to save reported hash: %v", markErr)
			}
		}
		return err
	}

	if applied {
		output, success := FormatResults(results)
		log.Printf("policy enforcement completed success=%v\n%s", success, output)
		if report != nil && reportChange {
			if reportErr := report(success, output); reportErr != nil {
				log.Printf("policy enforcement log upload failed: %v", reportErr)
			}
			if markErr := markConfigReported(configHash); markErr != nil {
				log.Printf("policy sync: failed to save reported hash: %v", markErr)
			}
		}
	}

	if err := SaveLastSyncedConfigHash(configHash); err != nil {
		log.Printf("policy sync: failed to save synced hash: %v", err)
	}

	return nil
}

// RunComplianceCheck verifies policy state against cached desired config and re-applies on drift.
func RunComplianceCheck(report Reporter, deploy apps.DeployOptions) error {
	if IsEmptyPolicyHash(LoadLastSyncedConfigHash()) {
		return nil
	}

	config, err := LoadDesiredConfig()
	if err != nil {
		return err
	}
	if config.UpdatedAt == "" || !config.HasAssignedPolicy() {
		return nil
	}

	if len(config.RequiredApps) > 0 {
		apps.DeployRequired(config.RequiredApps, deploy)
	}

	results, reconciled, err := ReconcileCompliance(config.Payload)
	if err != nil {
		output, _ := FormatResults(results)
		log.Printf("policy compliance reconciliation failed: %s", output)
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

// NewAppDeployOptions builds callbacks for app deployment status and Action Log steps.
func NewAppDeployOptions(client *api.APIClient, authToken, hardwareID string) apps.DeployOptions {
	opts := apps.DeployOptions{}
	if client != nil {
		opts.BaseURL = client.BaseURL()
	}
	if client == nil || authToken == "" || hardwareID == "" {
		return opts
	}

	opts.StatusReporter = func(appID uint, appName, status, errMsg string) error {
		return client.ReportAppStatus(authToken, hardwareID, appID, status, errMsg)
	}
	opts.StepLogger = func(appID uint, appName, step, output string) error {
		return client.ReportAppInstallLog(authToken, hardwareID, appID, appName, step, output)
	}
	return opts
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
