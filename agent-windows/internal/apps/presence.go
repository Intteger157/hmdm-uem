//go:build windows

package apps

import (
	"strings"

	"github.com/hmdm/agent-windows/internal/system"
)

// InstallPresence describes how a required app relates to local inventory.
type InstallPresence int

const (
	InstallMissing InstallPresence = iota
	InstallUpToDate
	InstallOutdated
)

// ExpectedVersion returns the policy version the agent should enforce.
func (app RequiredApp) ExpectedVersion() string {
	if v := strings.TrimSpace(app.ExpectedVersionField); v != "" {
		return v
	}
	return strings.TrimSpace(app.Version)
}

// EvaluateInstallPresence checks registry inventory for name + expected version.
func EvaluateInstallPresence(name, expectedVersion string, installed []system.InstalledSoftwareInfo) InstallPresence {
	targetName := strings.ToLower(strings.TrimSpace(name))
	if targetName == "" {
		return InstallMissing
	}

	expected := strings.TrimSpace(expectedVersion)
	var bestMatch *system.InstalledSoftwareInfo
	exactName := false

	for i := range installed {
		item := &installed[i]
		itemName := strings.ToLower(strings.TrimSpace(item.Name))
		if itemName == "" {
			continue
		}

		isExact := itemName == targetName
		isPartial := strings.Contains(itemName, targetName)
		if !isExact && !isPartial {
			continue
		}

		if bestMatch == nil {
			bestMatch = item
			exactName = isExact
			continue
		}
		// Prefer exact DisplayName matches over substring matches.
		if isExact && !exactName {
			bestMatch = item
			exactName = true
			continue
		}
		if isExact == exactName && CompareVersions(item.Version, bestMatch.Version) > 0 {
			bestMatch = item
		}
	}

	if bestMatch == nil {
		return InstallMissing
	}
	if expected == "" {
		return InstallUpToDate
	}
	if CompareVersions(bestMatch.Version, expected) >= 0 {
		return InstallUpToDate
	}
	return InstallOutdated
}

// isAppInstalled reports whether a matching app meets or exceeds the expected version.
func isAppInstalled(name, version string, installed []system.InstalledSoftwareInfo) bool {
	return EvaluateInstallPresence(name, version, installed) == InstallUpToDate
}
