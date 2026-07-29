//go:build windows

package taskmgr

import (
	"encoding/json"
	"fmt"

	"github.com/shirou/gopsutil/v4/process"
)

const messageTypeProcessList = "process_list"

// ProcessSnapshot is one running OS process sent to the admin panel.
type ProcessSnapshot struct {
	PID         int32   `json:"pid"`
	Name        string  `json:"name"`
	MemoryBytes uint64  `json:"memoryBytes"`
	CPUPercent  float64 `json:"cpuPercent"`
}

type processListMessage struct {
	Type      string            `json:"type"`
	Processes []ProcessSnapshot `json:"processes"`
}

type killCommand struct {
	Action string `json:"action"`
	PID    int32  `json:"pid"`
}

func collectProcessSnapshots() ([]ProcessSnapshot, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, fmt.Errorf("list processes: %w", err)
	}

	snapshots := make([]ProcessSnapshot, 0, len(procs))
	for _, proc := range procs {
		snapshot, ok := snapshotProcess(proc)
		if ok {
			snapshots = append(snapshots, snapshot)
		}
	}
	return snapshots, nil
}

func snapshotProcess(proc *process.Process) (ProcessSnapshot, bool) {
	if proc == nil {
		return ProcessSnapshot{}, false
	}

	name, err := proc.Name()
	if err != nil {
		return ProcessSnapshot{}, false
	}

	memInfo, err := proc.MemoryInfo()
	if err != nil {
		return ProcessSnapshot{}, false
	}

	cpuPercent, err := proc.CPUPercent()
	if err != nil {
		cpuPercent = 0
	}

	return ProcessSnapshot{
		PID:         proc.Pid,
		Name:        name,
		MemoryBytes: memInfo.RSS,
		CPUPercent:  cpuPercent,
	}, true
}

func encodeProcessListMessage(processes []ProcessSnapshot) ([]byte, error) {
	payload, err := json.Marshal(processListMessage{
		Type:      messageTypeProcessList,
		Processes: processes,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal process list: %w", err)
	}
	return payload, nil
}

func parseKillCommand(data []byte) (killCommand, error) {
	var cmd killCommand
	if err := json.Unmarshal(data, &cmd); err != nil {
		return killCommand{}, fmt.Errorf("invalid command json: %w", err)
	}
	if cmd.Action != "kill" {
		return killCommand{}, fmt.Errorf("unsupported action %q", cmd.Action)
	}
	if cmd.PID <= 0 {
		return killCommand{}, fmt.Errorf("invalid pid %d", cmd.PID)
	}
	return cmd, nil
}

func killProcessByPID(pid int32) error {
	proc, err := process.NewProcess(pid)
	if err != nil {
		return fmt.Errorf("find process %d: %w", pid, err)
	}
	if err := proc.Kill(); err != nil {
		return fmt.Errorf("kill process %d: %w", pid, err)
	}
	return nil
}
