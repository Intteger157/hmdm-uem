//go:build windows

package procexec

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const InstallTimeout = 20 * time.Minute

const InstallTimeoutMessage = "Execution timeout (20m)"

// ConfigureHiddenProcessGroup sets hidden window and a new process group for tree termination.
func ConfigureHiddenProcessGroup(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
	cmd.SysProcAttr.CreationFlags |= syscall.CREATE_NEW_PROCESS_GROUP
}

// KillProcessTree forcefully terminates a process and its children.
func KillProcessTree(pid int) error {
	if pid <= 0 {
		return nil
	}
	cmd := exec.Command("taskkill", "/T", "/F", "/PID", strconv.Itoa(pid))
	ConfigureHiddenProcessGroup(cmd)
	if err := cmd.Run(); err != nil {
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			return nil
		}
		return err
	}
	return nil
}

// IsTimeout reports whether err is a context deadline exceeded.
func IsTimeout(err error) bool {
	return errors.Is(err, context.DeadlineExceeded)
}

// RunResult holds captured process output and exit code.
type RunResult struct {
	PID      int
	ExitCode int
	Stdout   string
	Stderr   string
}

// Run starts cmd, waits for completion or ctx cancellation, and kills the process tree on timeout.
func Run(ctx context.Context, cmd *exec.Cmd, captureOutput bool) (RunResult, error) {
	ConfigureHiddenProcessGroup(cmd)

	var stdout, stderr bytes.Buffer
	if captureOutput {
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr
	}

	if err := cmd.Start(); err != nil {
		return RunResult{}, err
	}

	pid := cmd.Process.Pid
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		return RunResult{
			PID:      pid,
			ExitCode: exitCode(cmd, err),
			Stdout:   strings.TrimSpace(stdout.String()),
			Stderr:   strings.TrimSpace(stderr.String()),
		}, err
	case <-ctx.Done():
		_ = KillProcessTree(pid)
		<-done
		return RunResult{
			PID:      pid,
			ExitCode: -1,
			Stdout:   strings.TrimSpace(stdout.String()),
			Stderr:   strings.TrimSpace(stderr.String()),
		}, ctx.Err()
	}
}

// CombinedOutput runs cmd with timeout and returns merged stdout/stderr.
func CombinedOutput(ctx context.Context, cmd *exec.Cmd) (string, error) {
	result, err := Run(ctx, cmd, true)
	combined := strings.TrimSpace(strings.Join(filterNonEmpty(result.Stdout, result.Stderr), "\n"))
	if IsTimeout(err) {
		if combined != "" {
			combined += "\n"
		}
		combined += InstallTimeoutMessage
		return combined, fmt.Errorf("%s", InstallTimeoutMessage)
	}
	return combined, err
}

func filterNonEmpty(parts ...string) []string {
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func exitCode(cmd *exec.Cmd, runErr error) int {
	if cmd != nil && cmd.ProcessState != nil {
		return cmd.ProcessState.ExitCode()
	}
	if runErr == nil {
		return 0
	}
	var exitErr *exec.ExitError
	if errors.As(runErr, &exitErr) {
		return exitErr.ExitCode()
	}
	return -1
}
