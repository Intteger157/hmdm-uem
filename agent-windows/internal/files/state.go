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
	AppliedFiles  map[string]string `json:"applied_files,omitempty"`
	FailedRules   map[string]string `json:"failedRules,omitempty"`
}

func filesStateFilePath() string {
	return brand.ResolveDataPath(filesStateFileName)
}

func newEmptyFilesState() FilesState {
	return FilesState{
		DeployedRules: map[string]string{},
		AppliedFiles:  map[string]string{},
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
	if state.AppliedFiles == nil {
		state.AppliedFiles = map[string]string{}
	}
	if state.FailedRules == nil {
		state.FailedRules = map[string]string{}
	}
}

func ruleKey(deploymentID uint) string {
	return fmt.Sprintf("%d", deploymentID)
}

func (state FilesState) ShouldSkipDeploy(deployment RequiredFileDeployment) bool {
	key := ruleKey(deployment.ID)
	storedFingerprint := strings.TrimSpace(state.DeployedRules[key])
	expectedFingerprint := DeploymentFingerprint(deployment)
	if storedFingerprint != "" {
		if storedFingerprint == expectedFingerprint {
			return true
		}
		legacyUpdatedAt := strings.TrimSpace(deployment.UpdatedAt)
		if legacyUpdatedAt != "" && storedFingerprint == legacyUpdatedAt {
			return true
		}
	}

	fileSHA := strings.ToLower(strings.TrimSpace(deployment.SHA256))
	if deployment.FileID > 0 && fileSHA != "" {
		appliedSHA := strings.ToLower(strings.TrimSpace(state.AppliedFiles[appliedFileKey(deployment.FileID)]))
		if appliedSHA == fileSHA {
			return true
		}
	}
	return false
}

func (state *FilesState) MarkDeployed(deployment RequiredFileDeployment) {
	key := ruleKey(deployment.ID)
	state.DeployedRules[key] = DeploymentFingerprint(deployment)
	if deployment.FileID > 0 {
		if sha256 := strings.ToLower(strings.TrimSpace(deployment.SHA256)); sha256 != "" {
			state.AppliedFiles[appliedFileKey(deployment.FileID)] = sha256
		}
	}
	delete(state.FailedRules, key)
}

func (state *FilesState) MarkDeployFailed(deployment RequiredFileDeployment) {
	key := ruleKey(deployment.ID)
	state.FailedRules[key] = DeploymentFingerprint(deployment)
	delete(state.DeployedRules, key)
	if deployment.FileID > 0 {
		delete(state.AppliedFiles, appliedFileKey(deployment.FileID))
	}
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
