//go:build windows

package policies

import (
	"fmt"
	"strings"

	"github.com/hmdm/agent-windows/internal/apps"
	"github.com/hmdm/agent-windows/internal/files"
	"github.com/hmdm/agent-windows/internal/system"
)

const evaluationReportHeader = "=== Configuration Evaluation Report ===\n"

// BuildConfigurationEvaluationReport summarizes current compliance before async apply work starts.
func BuildConfigurationEvaluationReport(config EffectiveConfig, registry RegistryPoliciesConfig) string {
	var builder strings.Builder
	builder.WriteString(evaluationReportHeader)

	if !config.HasAssignedPolicy() && !registry.HasPolicies() {
		builder.WriteString("No configuration profile assigned.\n")
		return builder.String()
	}

	if name := strings.TrimSpace(config.ProfileName); name != "" {
		builder.WriteString(fmt.Sprintf("Profile: %s\n", name))
	} else if name := strings.TrimSpace(registry.ConfigurationName); name != "" {
		builder.WriteString(fmt.Sprintf("Profile: %s\n", name))
	}

	builder.WriteString("\nSecurity Policies:\n")
	appendSecurityPolicyLines(&builder, config.Payload)

	builder.WriteString("\nRegistry Policies:\n")
	appendRegistryPolicyLines(&builder, registry)

	builder.WriteString("\nApp Deployments:\n")
	appendAppDeploymentLines(&builder, config.RequiredApps)

	builder.WriteString("\nFile Deployments:\n")
	appendFileDeploymentLines(&builder, config.FileDeployments)

	return builder.String()
}

func appendSecurityPolicyLines(builder *strings.Builder, payload Payload) {
	_, results := IsCompliant(payload)
	if len(results) == 0 {
		builder.WriteString("- None assigned\n")
		return
	}
	for _, result := range results {
		builder.WriteString(fmt.Sprintf("- Policy [%s]: %s\n", result.Name, policyEvaluationStatus(result)))
	}
}

func policyEvaluationStatus(result Result) string {
	switch {
	case result.Success && result.Message == "not required":
		return "Not required"
	case result.Success:
		return "Already enforced"
	default:
		return "Scheduled for enforcement"
	}
}

func appendRegistryPolicyLines(builder *strings.Builder, registry RegistryPoliciesConfig) {
	if !registry.HasPolicies() {
		builder.WriteString("- None assigned\n")
		return
	}

	registryHash := RegistryPoliciesHash(registry)
	if registryHash == LoadLastSyncedRegistryHash() {
		builder.WriteString("- Registry policies: Already enforced\n")
		return
	}

	for _, policy := range registry.Policies {
		label := registryPolicyLabel(policy.PolicyPath)
		builder.WriteString(fmt.Sprintf("- Policy [%s]: Scheduled for enforcement\n", label))
	}
}

func registryPolicyLabel(policyPath string) string {
	path := strings.TrimSpace(policyPath)
	if path == "" {
		return "Registry"
	}
	if idx := strings.LastIndexAny(path, `\/`); idx >= 0 && idx+1 < len(path) {
		return path[idx+1:]
	}
	return path
}

func appendAppDeploymentLines(builder *strings.Builder, requiredApps []apps.RequiredApp) {
	if len(requiredApps) == 0 {
		builder.WriteString("- None assigned\n")
		return
	}

	appState, err := apps.LoadAppsState()
	if err != nil {
		appState = apps.AppsState{}
	}
	installed := system.CollectInstalledSoftware()
	for _, app := range requiredApps {
		builder.WriteString(apps.EvaluateRequiredApp(app, appState, installed))
		builder.WriteByte('\n')
	}
}

func appendFileDeploymentLines(builder *strings.Builder, deployments []files.RequiredFileDeployment) {
	if len(deployments) == 0 {
		builder.WriteString("- None assigned\n")
		return
	}

	fileState, err := files.LoadFilesState()
	if err != nil {
		fileState = files.FilesState{}
	}
	for _, deployment := range deployments {
		builder.WriteString(files.EvaluateFileDeployment(deployment, fileState))
		builder.WriteByte('\n')
	}
}
