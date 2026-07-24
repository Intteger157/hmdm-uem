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
)

const appsStateFilePath = `C:\ProgramData\HMDM\Agent\apps_state.json`

// AppsState tracks per-app update checks and locally confirmed deploy timestamps.
type AppsState struct {
	LastCheckTimes map[string]string `json:"lastCheckTimes"`
	// DeployedApps maps catalog app ID to the server UpdatedAt timestamp last deployed successfully.
	DeployedApps map[string]string `json:"deployedApps,omitempty"`
}

func LoadAppsState() (AppsState, error) {
	data, err := os.ReadFile(appsStateFilePath)
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
	if err := ensureAppsStateDirectory(); err != nil {
		return err
	}
	normalizeAppsState(&state)

	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal apps_state.json: %w", err)
	}
	if err := os.WriteFile(appsStateFilePath, payload, 0o644); err != nil {
		return fmt.Errorf("write apps_state.json: %w", err)
	}
	return nil
}

func newEmptyAppsState() AppsState {
	return AppsState{
		LastCheckTimes: map[string]string{},
		DeployedApps:   map[string]string{},
	}
}

func normalizeAppsState(state *AppsState) {
	if state.LastCheckTimes == nil {
		state.LastCheckTimes = map[string]string{}
	}
	if state.DeployedApps == nil {
		state.DeployedApps = map[string]string{}
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
func (state AppsState) ShouldSkipDeploy(appID uint, serverUpdatedAt string) bool {
	if state.DeployedApps == nil {
		return false
	}
	cachedUpdatedAt, ok := state.DeployedApps[appKey(appID)]
	if !ok || strings.TrimSpace(cachedUpdatedAt) == "" {
		return false
	}

	cachedTime := parseAppTimestamp(cachedUpdatedAt)
	serverTime := parseAppTimestamp(serverUpdatedAt)
	if cachedTime.IsZero() || serverTime.IsZero() {
		return false
	}

	return !cachedTime.Before(serverTime)
}

// MarkDeployed records the catalog UpdatedAt timestamp for a successful deployment.
func (state *AppsState) MarkDeployed(appID uint, updatedAt string) {
	if state.DeployedApps == nil {
		state.DeployedApps = map[string]string{}
	}
	normalized := normalizeAppTimestamp(updatedAt)
	if normalized == "" {
		normalized = time.Now().UTC().Format(time.RFC3339)
	}
	state.DeployedApps[appKey(appID)] = normalized
	state.MarkChecked(appID, time.Now().UTC())
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

func ensureAppsStateDirectory() error {
	dir := filepath.Dir(appsStateFilePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create apps state directory: %w", err)
	}
	return nil
}
