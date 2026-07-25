package desktop

import (
	"testing"
	"time"
)

func TestRecordSuccessfulSync(t *testing.T) {
	t.Setenv("PROGRAMDATA", t.TempDir())

	at := time.Date(2026, 7, 25, 12, 30, 0, 0, time.UTC)
	if err := RecordSuccessfulSync(at); err != nil {
		t.Fatalf("RecordSuccessfulSync() error = %v", err)
	}

	display := loadLastSyncDisplay()
	if display == "" || display == "Never" {
		t.Fatalf("loadLastSyncDisplay() = %q, want formatted timestamp", display)
	}
}

func TestLocalURL(t *testing.T) {
	t.Parallel()

	if got := LocalURL(); got != "http://127.0.0.1:49152/" {
		t.Fatalf("LocalURL() = %q", got)
	}
}
