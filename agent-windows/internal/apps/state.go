//go:build windows

package apps

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
)

const appsStateFileName = "apps_state.json"

// AppsState tracks per-app update checks and locally confirmed deploy timestamps.
type AppsState struct {
	LastCheckTimes map[string]string `json:"lastCheckTimes"`
	// DeployedApps maps catalog app ID to the server UpdatedAt timestamp last deployed successfully.
	DeployedApps map[string]string `json:"deployedApps,omitempty"`
	// FailedApps maps catalog app ID to the last failed deployment timestamp.
	FailedApps map[string]string `json:"failedApps,omitempty"`
	// DriftRepairs maps catalog app ID to the revision fingerprint that was already
	// redeployed once because the app vanished from local inventory.
	DriftRepairs map[string]string `json:"driftRepairs,omitempty"`
}

func appsStateFilePath() string {
	return brand.ResolveDataPath(appsStateFileName)
}

func LoadAppsState() (AppsState, error) {
	data, err := os.ReadFile(appsStateFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return newEmptyAppsState(), nil
		}
		return AppsState{}, fmt.Errorf("read apps_state.json: %w", err)
	}

	var state AppsState
	if err := json.Unmarshal(data, &state); err != nil {
		return AppsState{}, fmt.Errorf("decode apps_state.json: %w", err)
	}
	normalizeAppsState(&state)
	return state, nil
}

func SaveAppsState(state AppsState) error {
	dir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return fmt.Errorf("create apps state directory: %w", err)
	}
	normalizeAppsState(&state)

	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal apps_state.json: %w", err)
	}
	path := filepath.Join(dir, appsStateFileName)
	if err := os.WriteFile(path, payload, 0o644); err != nil {
		return fmt.Errorf("write apps_state.json: %w", err)
	}
	return nil
}

func newEmptyAppsState() AppsState {
	return AppsState{
		LastCheckTimes: map[string]string{},
		DeployedApps:   map[string]string{},
		FailedApps:     map[string]string{},
		DriftRepairs:   map[string]string{},
	}
}

func normalizeAppsState(state *AppsState) {
	if state.LastCheckTimes == nil {
		state.LastCheckTimes = map[string]string{}
	}
	if state.DeployedApps == nil {
		state.DeployedApps = map[string]string{}
	}
	if state.FailedApps == nil {
		state.FailedApps = map[string]string{}
	}
	if state.DriftRepairs == nil {
		state.DriftRepairs = map[string]string{}
	}
}

func (state AppsState) LastCheckTime(appID uint) time.Time {
	raw, ok := state.LastCheckTimes[appKey(appID)]
	if !ok || raw == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return time.Time{}
	}
	return parsed
}

func (state *AppsState) MarkChecked(appID uint, checkedAt time.Time) {
	if state.LastCheckTimes == nil {
		state.LastCheckTimes = map[string]string{}
	}
	state.LastCheckTimes[appKey(appID)] = checkedAt.UTC().Format(time.RFC3339)
}

// ShouldSkipDeploy reports whether the agent already deployed this catalog revision.
func (state AppsState) ShouldSkipDeploy(app RequiredApp) bool {
	if state.DeployedApps == nil {
		return false
	}
	key := appKey(app.ID)
	stored := strings.TrimSpace(state.DeployedApps[key])
	if stored == "" {
		return false
	}

	expected := AppDeploymentFingerprint(app)
	if stored == expected {
		return true
	}
	if stored == strings.TrimSpace(app.UpdatedAt) {
		return true
	}

	cachedTime := parseAppTimestamp(stored)
	serverTime := parseAppTimestamp(app.UpdatedAt)
	if !cachedTime.IsZero() && !serverTime.IsZero() {
		return !cachedTime.Before(serverTime)
	}
	return false
}

// DriftRepairAttempted reports whether this revision was already redeployed once
// because the app was missing from local inventory. It keeps a permanent name
// mismatch between the catalog and the registry DisplayName from turning into a
// reinstall loop on every compliance check.
func (state AppsState) DriftRepairAttempted(app RequiredApp) bool {
	if state.DriftRepairs == nil {
		return false
	}
	return strings.TrimSpace(state.DriftRepairs[appKey(app.ID)]) == AppDeploymentFingerprint(app)
}

// MarkDriftRepairAttempted records that the app was redeployed for this revision
// because local inventory reported it as missing.
func (state *AppsState) MarkDriftRepairAttempted(app RequiredApp) {
	if state.DriftRepairs == nil {
		state.DriftRepairs = map[string]string{}
	}
	state.DriftRepairs[appKey(app.ID)] = AppDeploymentFingerprint(app)
}

// HasDeployedRevision reports whether this agent already deployed any revision of the app.
func (state AppsState) HasDeployedRevision(appID uint) bool {
	if state.DeployedApps == nil {
		return false
	}
	return strings.TrimSpace(state.DeployedApps[appKey(appID)]) != ""
}

// MarkDeployed records the catalog revision fingerprint for a successful deployment.
func (state *AppsState) MarkDeployed(app RequiredApp) {
	if state.DeployedApps == nil {
		state.DeployedApps = map[string]string{}
	}
	if state.FailedApps != nil {
		delete(state.FailedApps, appKey(app.ID))
	}
	normalized := AppDeploymentFingerprint(app)
	if normalized == "" {
		normalized = normalizeAppTimestamp(app.UpdatedAt)
	}
	if normalized == "" {
		normalized = time.Now().UTC().Format(time.RFC3339)
	}
	state.DeployedApps[appKey(app.ID)] = normalized
	state.MarkChecked(app.ID, time.Now().UTC())
}

// MarkDeployFailed records a failed deployment for this catalog revision.
func (state *AppsState) MarkDeployFailed(appID uint, updatedAt string) {
	if state.FailedApps == nil {
		state.FailedApps = map[string]string{}
	}
	normalized := normalizeAppTimestamp(updatedAt)
	if normalized == "" {
		normalized = time.Now().UTC().Format(time.RFC3339)
	}
	state.FailedApps[appKey(appID)] = normalized
	state.MarkChecked(appID, time.Now().UTC())
}

// ShouldSkipFailed skips redeploying until the catalog UpdatedAt changes or admin retries on server.
func (state AppsState) ShouldSkipFailed(appID uint, serverUpdatedAt string) bool {
	if state.FailedApps == nil {
		return false
	}
	failedRevision, ok := state.FailedApps[appKey(appID)]
	if !ok || strings.TrimSpace(failedRevision) == "" {
		return false
	}
	return normalizeAppTimestamp(failedRevision) == normalizeAppTimestamp(serverUpdatedAt)
}

func parseAppTimestamp(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed.UTC()
		}
	}
	return time.Time{}
}

func normalizeAppTimestamp(raw string) string {
	parsed := parseAppTimestamp(raw)
	if parsed.IsZero() {
		return strings.TrimSpace(raw)
	}
	return parsed.UTC().Format(time.RFC3339)
}

func appKey(appID uint) string {
	return strconv.FormatUint(uint64(appID), 10)
}
