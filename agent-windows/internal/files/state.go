//go:build windows

package files

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
)

const filesStateFileName = "files_state.json"

type FilesState struct {
	DeployedRules map[string]string `json:"deployedRules,omitempty"`
	FailedRules   map[string]string `json:"failedRules,omitempty"`
}

func filesStateFilePath() string {
	return brand.ResolveDataPath(filesStateFileName)
}

func newEmptyFilesState() FilesState {
	return FilesState{
		DeployedRules: map[string]string{},
		FailedRules:   map[string]string{},
	}
}

func LoadFilesState() (FilesState, error) {
	data, err := os.ReadFile(filesStateFilePath())
	if err != nil {
		if os.IsNotExist(err) {
			return newEmptyFilesState(), nil
		}
		return FilesState{}, fmt.Errorf("read files_state.json: %w", err)
	}

	var state FilesState
	if err := json.Unmarshal(data, &state); err != nil {
		return FilesState{}, fmt.Errorf("decode files_state.json: %w", err)
	}
	normalizeFilesState(&state)
	return state, nil
}

func SaveFilesState(state FilesState) error {
	dir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return fmt.Errorf("create files state directory: %w", err)
	}
	normalizeFilesState(&state)

	payload, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal files_state.json: %w", err)
	}
	path := filepath.Join(dir, filesStateFileName)
	if err := os.WriteFile(path, payload, 0o644); err != nil {
		return fmt.Errorf("write files_state.json: %w", err)
	}
	return nil
}

func normalizeFilesState(state *FilesState) {
	if state.DeployedRules == nil {
		state.DeployedRules = map[string]string{}
	}
	if state.FailedRules == nil {
		state.FailedRules = map[string]string{}
	}
}

func ruleKey(deploymentID uint) string {
	return fmt.Sprintf("%d", deploymentID)
}

func (state FilesState) ShouldSkipDeploy(deploymentID uint, updatedAt string) bool {
	key := ruleKey(deploymentID)
	storedUpdatedAt := strings.TrimSpace(state.DeployedRules[key])
	if storedUpdatedAt == "" {
		return false
	}
	return storedUpdatedAt == strings.TrimSpace(updatedAt)
}

func (state *FilesState) MarkDeployed(deploymentID uint, updatedAt string) {
	key := ruleKey(deploymentID)
	state.DeployedRules[key] = strings.TrimSpace(updatedAt)
	delete(state.FailedRules, key)
}

func (state *FilesState) MarkDeployFailed(deploymentID uint, updatedAt string) {
	key := ruleKey(deploymentID)
	state.FailedRules[key] = strings.TrimSpace(updatedAt)
	delete(state.DeployedRules, key)
}

func parseUpdatedAt(value string) time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err == nil {
		return parsed
	}
	parsed, err = time.Parse(time.RFC3339, value)
	if err == nil {
		return parsed
	}
	return time.Time{}
}
