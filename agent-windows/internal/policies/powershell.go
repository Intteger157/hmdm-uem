//go:build windows

package policies

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
	"syscall"
	"time"
)

func runPowerShellScript(script string, timeout time.Duration) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			message = err.Error()
		}
		return message, fmt.Errorf("%s", message)
	}
	return message, nil
}

func runCommand(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			message = err.Error()
		}
		return message, fmt.Errorf("%s", message)
	}
	return message, nil
}

func formatResults(results []Result) (string, bool) {
	lines := make([]string, 0, len(results))
	allSuccess := true
	for _, result := range results {
		status := "Success"
		if !result.Success {
			status = "Failed"
			allSuccess = false
		}
		message := strings.TrimSpace(result.Message)
		if message == "" {
			message = status
		}
		lines = append(lines, fmt.Sprintf("%s: %s - %s", result.Name, status, message))
	}
	return strings.Join(lines, "\n"), allSuccess
}
