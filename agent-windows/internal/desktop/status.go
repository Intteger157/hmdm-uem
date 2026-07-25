package desktop

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
)

const desktopStatusFileName = "desktop-status.json"

type persistedStatus struct {
	LastSyncAt string `json:"lastSyncAt,omitempty"`
}

func statusFilePath() string {
	return brand.ResolveDataPath(desktopStatusFileName)
}

// RecordSuccessfulSync stores the timestamp of the last successful inventory sync.
func RecordSuccessfulSync(at time.Time) error {
	if at.IsZero() {
		at = time.Now().UTC()
	}

	dir, err := brand.EnsureProgramDataDir()
	if err != nil {
		return err
	}

	payload, err := json.MarshalIndent(persistedStatus{
		LastSyncAt: at.UTC().Format(time.RFC3339),
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal desktop status: %w", err)
	}

	if err := os.WriteFile(filepath.Join(dir, desktopStatusFileName), payload, 0o644); err != nil {
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
