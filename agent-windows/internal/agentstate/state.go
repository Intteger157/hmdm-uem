package agentstate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/hmdm/agent-windows/internal/brand"
)

const stateFileName = "state.json"

// State holds persisted agent identifiers used by the tray helper.
type State struct {
	DeviceID string `json:"device_id"`
}

func stateFilePath() string {
	return brand.ResolveDataPath(stateFileName)
}

func Load() (State, error) {
	data, err := os.ReadFile(stateFilePath())
	if err != nil {
		return State{}, fmt.Errorf("read state.json: %w", err)
	}

	var state State
	if err := json.Unmarshal(data, &state); err != nil {
		return State{}, fmt.Errorf("decode state.json: %w", err)
	}

	state.DeviceID = strings.TrimSpace(state.DeviceID)
	return state, nil
}

func SaveDeviceID(deviceID string) error {
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return fmt.Errorf("device id is empty")
	}

	dir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return fmt.Errorf("create agent state directory: %w", err)
	}

	payload, err := json.MarshalIndent(State{DeviceID: deviceID}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state.json: %w", err)
	}

	path := filepath.Join(dir, stateFileName)
	if err := os.WriteFile(path, payload, 0o644); err != nil {
		return fmt.Errorf("write state.json: %w", err)
	}

	return nil
}
