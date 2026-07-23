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

// InstalledAppEntry records a successful deployment for one catalog app.
type InstalledAppEntry struct {
	Version     string `json:"version"`
	InstalledAt string `json:"installedAt,omitempty"`
}

// AppsState tracks per-app update checks and locally confirmed installs on the device.
type AppsState struct {
	LastCheckTimes map[string]string            `json:"lastCheckTimes"`
	InstalledApps  map[string]InstalledAppEntry `json:"installedApps,omitempty"`
}

func LoadAppsState() (AppsState, error) {
	data, err := os.ReadFile(appsStateFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return AppsState{LastCheckTimes: map[string]string{}}, nil
		}
		return AppsState{}, fmt.Errorf("read apps_state.json: %w", err)
	}

	var state AppsState
	if err := json.Unmarshal(data, &state); err != nil {
		return AppsState{}, fmt.Errorf("decode apps_state.json: %w", err)
	}
	if state.LastCheckTimes == nil {
		state.LastCheckTimes = map[string]string{}
	}
	if state.InstalledApps == nil {
		state.InstalledApps = map[string]InstalledAppEntry{}
	}
	return state, nil
}

func SaveAppsState(state AppsState) error {
	if err := ensureAppsStateDirectory(); err != nil {
		return err
	}
	if state.LastCheckTimes == nil {
		state.LastCheckTimes = map[string]string{}
	}
	if state.InstalledApps == nil {
		state.InstalledApps = map[string]InstalledAppEntry{}
	}

	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal apps_state.json: %w", err)
	}
	if err := os.WriteFile(appsStateFilePath, payload, 0o644); err != nil {
		return fmt.Errorf("write apps_state.json: %w", err)
	}
	return nil
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

// HasInstalledVersion reports whether the agent already deployed this app version successfully.
func (state AppsState) HasInstalledVersion(appID uint, version string) bool {
	if state.InstalledApps == nil {
		return false
	}
	entry, ok := state.InstalledApps[appKey(appID)]
	if !ok {
		return false
	}
	return appVersionsMatch(entry.Version, version)
}

// MarkInstalled records a successful deployment in the local cache.
func (state *AppsState) MarkInstalled(appID uint, version string) {
	if state.InstalledApps == nil {
		state.InstalledApps = map[string]InstalledAppEntry{}
	}
	state.InstalledApps[appKey(appID)] = InstalledAppEntry{
		Version:     strings.TrimSpace(version),
		InstalledAt: time.Now().UTC().Format(time.RFC3339),
	}
	state.MarkChecked(appID, time.Now().UTC())
}

func appVersionsMatch(installed, required string) bool {
	return strings.EqualFold(strings.TrimSpace(installed), strings.TrimSpace(required))
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
