//go:build windows

package policies

import (
	"log"

	"github.com/hmdm/agent-windows/internal/apps"
	"github.com/hmdm/agent-windows/internal/files"
)

type effectiveConfigFetcher func() (EffectiveConfig, error)
type registryConfigFetcher func() (RegistryPoliciesConfig, error)

// ForceApplyConfiguration evaluates the assigned configuration, returns a report,
// and schedules asynchronous enforcement work.
func ForceApplyConfiguration(
	fetchEffective effectiveConfigFetcher,
	fetchRegistry registryConfigFetcher,
	deploy apps.DeployOptions,
	fileDeploy files.DeployOptions,
	uploadBitLockerKey BitLockerKeyUploader,
) (string, error) {
	config, err := fetchEffectiveConfig(fetchEffective)
	if err != nil {
		return "", err
	}

	registryConfig, err := fetchRegistryConfig(fetchRegistry)
	if err != nil {
		log.Printf("force apply configuration: registry fetch failed, using cached registry policies if available: %v", err)
	}

	report := BuildConfigurationEvaluationReport(config, registryConfig)
	scheduleConfigurationApply(config, registryConfig, deploy, fileDeploy, uploadBitLockerKey)
	return report, nil
}

func fetchEffectiveConfig(fetch effectiveConfigFetcher) (EffectiveConfig, error) {
	config, err := fetch()
	if err != nil {
		cached, cacheErr := LoadDesiredConfig()
		if cacheErr != nil || !cached.HasAssignedPolicy() {
			return EffectiveConfig{}, err
		}
		log.Printf("force apply configuration: using cached config.json (%v)", err)
		return cached, nil
	}
	return config, nil
}

func fetchRegistryConfig(fetch registryConfigFetcher) (RegistryPoliciesConfig, error) {
	if fetch == nil {
		return RegistryPoliciesConfig{}, nil
	}

	config, err := fetch()
	if err != nil {
		cached, cacheErr := LoadDesiredRegistryPolicies()
		if cacheErr != nil || !cached.HasPolicies() {
			return RegistryPoliciesConfig{}, err
		}
		log.Printf("force apply configuration: using cached registry-policies.json (%v)", err)
		return cached, nil
	}
	return config, nil
}

func scheduleConfigurationApply(
	config EffectiveConfig,
	registry RegistryPoliciesConfig,
	deploy apps.DeployOptions,
	fileDeploy files.DeployOptions,
	uploadBitLockerKey BitLockerKeyUploader,
) {
	go applyConfigurationAsync(config, registry, deploy, fileDeploy, uploadBitLockerKey)
}

func applyConfigurationAsync(
	config EffectiveConfig,
	registry RegistryPoliciesConfig,
	deploy apps.DeployOptions,
	fileDeploy files.DeployOptions,
	uploadBitLockerKey BitLockerKeyUploader,
) {
	if config.HasAssignedPolicy() {
		if err := SaveDesiredConfig(config); err != nil {
			log.Printf("force apply configuration: failed to save config.json: %v", err)
		}

		if len(config.RequiredApps) > 0 {
			log.Printf("force apply configuration: scheduling %d required app(s)", len(config.RequiredApps))
			apps.DeployRequiredAsync(config.RequiredApps, deploy)
		}
		if len(config.FileDeployments) > 0 {
			log.Printf("force apply configuration: scheduling %d file deployment rule(s)", len(config.FileDeployments))
			files.DeployRequiredAsync(config.FileDeployments, fileDeploy)
		}

		configHash := ConfigHash(config)
		if configHash != LoadLastSyncedConfigHash() {
			results, applied, err := ApplyIfNeeded(config.Payload)
			uploadEscrowedBitLockerKey(results, uploadBitLockerKey)
			if err != nil {
				output, _ := FormatResults(results)
				log.Printf("force apply configuration: policy enforcement failed: %s", output)
			} else if applied {
				output, success := FormatResults(results)
				log.Printf("force apply configuration: policy enforcement completed success=%v\n%s", success, output)
			}
			if err == nil {
				if saveErr := SaveLastSyncedConfigHash(configHash); saveErr != nil {
					log.Printf("force apply configuration: failed to save synced hash: %v", saveErr)
				}
			}
		}
	}

	if err := SaveDesiredRegistryPolicies(registry); err != nil {
		log.Printf("force apply configuration: failed to save registry-policies.json: %v", err)
	}

	registryHash := RegistryPoliciesHash(registry)
	if registryHash != LoadLastSyncedRegistryHash() {
		results, applied, err := ApplyRegistryPoliciesIfNeeded(registry.Policies)
		if err != nil {
			output, _ := FormatResults(results)
			log.Printf("force apply configuration: registry policy enforcement failed: %s", output)
		} else if applied {
			output, success := FormatResults(results)
			log.Printf("force apply configuration: registry policy enforcement completed success=%v\n%s", success, output)
		}
		if err == nil {
			if saveErr := SaveLastSyncedRegistryHash(registryHash); saveErr != nil {
				log.Printf("force apply configuration: failed to save registry synced hash: %v", saveErr)
			}
		}
	}
}
