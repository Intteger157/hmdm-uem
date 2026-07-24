package agentstate

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const stateFilePath = `C:\ProgramData\HMDM\Agent\state.json`

// State holds persisted agent identifiers used by the tray helper.
type State struct {
	DeviceID string `json:"device_id"`
}

func Load() (State, error) {
	data, err := os.ReadFile(stateFilePath)
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

	if err := ensureDirectory(); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(State{DeviceID: deviceID}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal state.json: %w", err)
	}

	if err := os.WriteFile(stateFilePath, payload, 0o644); err != nil {
		return fmt.Errorf("write state.json: %w", err)
	}

	return nil
}

func ensureDirectory() error {
	dir := filepath.Dir(stateFilePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create agent state directory: %w", err)
	}
	return nil
}
