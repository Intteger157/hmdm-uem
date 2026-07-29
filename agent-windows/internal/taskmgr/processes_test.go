//go:build windows

package taskmgr

import (
	"encoding/json"
	"testing"
)

func TestEncodeProcessListMessage(t *testing.T) {
	t.Parallel()

	payload, err := encodeProcessListMessage([]ProcessSnapshot{
		{PID: 123, Name: "powershell.exe", MemoryBytes: 4096, CPUPercent: 1.5},
	})
	if err != nil {
		t.Fatalf("encodeProcessListMessage: %v", err)
	}

	var parsed processListMessage
	if err := json.Unmarshal(payload, &parsed); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if parsed.Type != messageTypeProcessList {
		t.Fatalf("type = %q", parsed.Type)
	}
	if len(parsed.Processes) != 1 || parsed.Processes[0].PID != 123 {
		t.Fatalf("unexpected processes: %+v", parsed.Processes)
	}
}

func TestParseKillCommand(t *testing.T) {
	t.Parallel()

	cmd, err := parseKillCommand([]byte(`{"action":"kill","pid":4321}`))
	if err != nil {
		t.Fatalf("parseKillCommand: %v", err)
	}
	if cmd.PID != 4321 {
		t.Fatalf("pid = %d", cmd.PID)
	}

	if _, err := parseKillCommand([]byte(`{"action":"restart","pid":1}`)); err == nil {
		t.Fatal("expected unsupported action error")
	}
}

func TestCollectProcessSnapshotsIncludesCurrentProcess(t *testing.T) {
	processes, err := collectProcessSnapshots()
	if err != nil {
		t.Fatalf("collectProcessSnapshots: %v", err)
	}
	if len(processes) == 0 {
		t.Fatal("expected at least one process")
	}
}
