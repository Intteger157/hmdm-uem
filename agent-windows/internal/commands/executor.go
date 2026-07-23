//go:build windows

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/hmdm/agent-windows/internal/session"
)

// Result captures command execution outcome.
type Result struct {
	Success bool
	Message string
}

type powershellPayload struct {
	Script string `json:"script"`
}

type installPayload struct {
	URL string `json:"url"`
}

// Execute runs a remote command locally on the Windows agent.
func Execute(action string, payload json.RawMessage) Result {
	switch action {
	case "sync":
		return Result{Success: true, Message: "inventory sync requested"}
	case "restart":
		return restart()
	case "lock":
		return lockWorkstation()
	case "bitlocker_enable":
		return enableBitLocker()
	case "powershell":
		return runPowerShell(payload)
	case "install":
		return installSoftware(payload)
	case "wipe":
		return Result{Success: false, Message: "factory wipe is not implemented yet"}
	case "get_services":
		return getServices()
	case "restart_service":
		return restartService(payload)
	default:
		return Result{Success: false, Message: fmt.Sprintf("unsupported action: %s", action)}
	}
}

func restart() Result {
	cmd := exec.Command("shutdown.exe", "/r", "/t", "60", "/c", "MDM remote restart scheduled in 60 seconds")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := cmd.CombinedOutput(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("restart failed: %v (%s)", err, strings.TrimSpace(string(output)))}
	}
	return Result{Success: true, Message: "restart scheduled in 60 seconds"}
}

func lockWorkstation() Result {
	if err := session.RunInteractive(`rundll32.exe user32.dll,LockWorkStation`); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("lock failed: %v", err)}
	}
	return Result{Success: true, Message: "workstation locked"}
}

func enableBitLocker() Result {
	statusCmd := exec.Command("manage-bde.exe", "-status", "C:")
	statusCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	statusOutput, err := statusCmd.CombinedOutput()
	if err == nil && strings.Contains(strings.ToLower(string(statusOutput)), "protection on") {
		return Result{Success: true, Message: "BitLocker already enabled on C:"}
	}

	onCmd := exec.Command("manage-bde.exe", "-on", "C:", "-used", "-RecoveryPassword")
	onCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := onCmd.CombinedOutput(); err != nil {
		return Result{
			Success: false,
			Message: fmt.Sprintf("BitLocker enable failed (admin rights required): %v (%s)", err, strings.TrimSpace(string(output))),
		}
	}
	return Result{Success: true, Message: "BitLocker enable started on C:"}
}

func runPowerShell(payload json.RawMessage) Result {
	var parsed powershellPayload
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &parsed); err != nil {
			return Result{Success: false, Message: fmt.Sprintf("invalid powershell payload: %v", err)}
		}
	}
	script := strings.TrimSpace(parsed.Script)
	if script == "" {
		return Result{Success: false, Message: "powershell script is empty"}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if len(message) > 4000 {
		message = message[:4000] + "..."
	}
	if err != nil {
		if message == "" {
			message = err.Error()
		}
		return Result{Success: false, Message: message}
	}
	if message == "" {
		message = "powershell script completed"
	}
	return Result{Success: true, Message: message}
}

func installSoftware(payload json.RawMessage) Result {
	var parsed installPayload
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("invalid install payload: %v", err)}
	}
	url := strings.TrimSpace(parsed.URL)
	if url == "" {
		return Result{Success: false, Message: "install url is required"}
	}

	tempDir, err := os.MkdirTemp("", "hmdm-install-*")
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("create temp dir failed: %v", err)}
	}
	defer os.RemoveAll(tempDir)

	installerPath := tempDir + `\installer.exe`
	downloadCmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		fmt.Sprintf("Invoke-WebRequest -Uri '%s' -OutFile '%s'", escapePowerShellSingleQuoted(url), escapePowerShellSingleQuoted(installerPath)),
	)
	downloadCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := downloadCmd.CombinedOutput(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("download failed: %v (%s)", err, strings.TrimSpace(string(output)))}
	}

	installCmd := exec.Command(installerPath, "/quiet", "/norestart")
	installCmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := installCmd.CombinedOutput(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("install failed: %v (%s)", err, strings.TrimSpace(string(output)))}
	}
	return Result{Success: true, Message: "installer launched successfully"}
}

func escapePowerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}
