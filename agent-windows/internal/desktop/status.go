package desktop

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const defaultStatusFilePath = `C:\ProgramData\HMDM\Agent\desktop-status.json`

type persistedStatus struct {
	LastSyncAt string `json:"lastSyncAt,omitempty"`
}

func statusFilePath() string {
	if root := strings.TrimSpace(os.Getenv("PROGRAMDATA")); root != "" {
		return filepath.Join(root, "HMDM", "Agent", "desktop-status.json")
	}
	return defaultStatusFilePath
}

// RecordSuccessfulSync stores the timestamp of the last successful inventory sync.
func RecordSuccessfulSync(at time.Time) error {
	if at.IsZero() {
		at = time.Now().UTC()
	}

	if err := ensureDirectory(); err != nil {
		return err
	}

	payload, err := json.MarshalIndent(persistedStatus{
		LastSyncAt: at.UTC().Format(time.RFC3339),
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal desktop status: %w", err)
	}

	if err := os.WriteFile(statusFilePath(), payload, 0o644); err != nil {
		return fmt.Errorf("write desktop status: %w", err)
	}
	return nil
}

func loadLastSyncDisplay() string {
	data, err := os.ReadFile(statusFilePath())
	if err != nil {
		return "Never"
	}

	var status persistedStatus
	if err := json.Unmarshal(data, &status); err != nil {
		return "Never"
	}
	if status.LastSyncAt == "" {
		return "Never"
	}

	parsed, err := time.Parse(time.RFC3339, status.LastSyncAt)
	if err != nil {
		return status.LastSyncAt
	}

	return parsed.Local().Format("Jan 2, 2006 3:04 PM")
}

func ensureDirectory() error {
	dir := filepath.Dir(statusFilePath())
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create desktop status directory: %w", err)
	}
	return nil
}
