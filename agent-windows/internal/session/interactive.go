//go:build windows

package session

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"
)

// RunInteractive launches a command in the logged-on user's interactive session.
// Works from the LocalSystem service context via a short-lived scheduled task (/IT).
func RunInteractive(commandLine string) error {
	taskName := fmt.Sprintf("HMDMAgent_%d", time.Now().UnixNano())

	defer func() {
		cleanup := exec.Command("schtasks.exe", "/Delete", "/TN", taskName, "/F")
		cleanup.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = cleanup.Run()
	}()

	create := exec.Command(
		"schtasks.exe",
		"/Create",
		"/TN", taskName,
		"/TR", commandLine,
		"/SC", "ONCE",
		"/ST", "00:00",
		"/F",
		"/IT",
	)
	create.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := create.CombinedOutput(); err != nil {
		return fmt.Errorf("create interactive task: %w (%s)", err, trimOutput(output))
	}

	run := exec.Command("schtasks.exe", "/Run", "/TN", taskName)
	run.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := run.CombinedOutput(); err != nil {
		return fmt.Errorf("run interactive task: %w (%s)", err, trimOutput(output))
	}

	return nil
}

func trimOutput(raw []byte) string {
	const maxLen = 500
	text := string(raw)
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen] + "..."
}
