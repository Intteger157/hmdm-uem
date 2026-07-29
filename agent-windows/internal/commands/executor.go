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

	"github.com/hmdm/agent-windows/internal/brand"
	"github.com/hmdm/agent-windows/internal/policies"
	"github.com/hmdm/agent-windows/internal/procexec"
	"github.com/hmdm/agent-windows/internal/session"
)

// Result captures command execution outcome.
type Result struct {
	Success bool
	Message string
}

type powershellPayload struct {
	Script           string `json:"script"`
	ExecutionContext string `json:"executionContext"`
}

type installPayload struct {
	URL string `json:"url"`
}

// ExecutePowerShellScript runs a script string and returns captured stdout/stderr.
func ExecutePowerShellScript(payload string) Result {
	payload = strings.TrimSpace(payload)
	if payload == "" {
		return Result{Success: false, Message: "powershell script is empty"}
	}

	if strings.HasPrefix(payload, "{") {
		var parsed powershellPayload
		if err := json.Unmarshal([]byte(payload), &parsed); err == nil && strings.TrimSpace(parsed.Script) != "" {
			return runPowerShellWithContext(parsed.Script, parsed.ExecutionContext)
		}
	}

	return runPowerShellWithContext(payload, "System")
}

func runPowerShellWithContext(script, executionContext string) Result {
	script = strings.TrimSpace(script)
	if script == "" {
		return Result{Success: false, Message: "powershell script is empty"}
	}

	if strings.EqualFold(strings.TrimSpace(executionContext), "User") {
		commandLine := fmt.Sprintf(
			`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command %s`,
			quotePowerShellCommandArg(script),
		)
		if err := session.RunInteractive(commandLine); err != nil {
			return Result{Success: false, Message: fmt.Sprintf("run in user session failed: %v", err)}
		}
		return Result{Success: true, Message: "powershell script launched in logged-on user session"}
	}

	payload, err := json.Marshal(powershellPayload{Script: script, ExecutionContext: "System"})
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("marshal payload: %v", err)}
	}
	return runPowerShell(payload)
}

func quotePowerShellCommandArg(value string) string {
	return fmt.Sprintf(`'%s'`, strings.ReplaceAll(value, "'", "''"))
}

// Execute runs a remote command locally on the Windows agent. Some actions (such
// as remote_support) require opts with server credentials; pass nil when unused.
func Execute(action string, payload json.RawMessage, opts *ExecuteOptions) Result {
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
	case "wipe", "factory_reset":
		return factoryWipe()
	case "manage_local_group":
		return manageLocalGroup(payload)
	case "get_services":
		return getServices()
	case "restart_service":
		return restartService(payload)
	case CommandNameRemoteSupport:
		if opts == nil {
			return Result{Success: false, Message: "remote_support requires agent runtime context"}
		}
		return ExecuteRemoteSupport(*opts, payload)
	case CommandNameStartTaskManager:
		if opts == nil {
			return Result{Success: false, Message: "start_task_manager requires agent runtime context"}
		}
		return ExecuteStartTaskManager(*opts, payload)
	case CommandNameStartFileExplorer:
		if opts == nil {
			return Result{Success: false, Message: "start_file_explorer requires agent runtime context"}
		}
		return ExecuteStartFileExplorer(*opts, payload)
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
	result := policies.ApplyBitLockerMDMPolicy()
	return Result{Success: result.Success, Message: result.Message}
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

	tempDir, err := os.MkdirTemp("", brand.InstallTempPrefix+"*")
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("create temp dir failed: %v", err)}
	}
	defer os.RemoveAll(tempDir)

	installerPath := tempDir + `\installer.exe`

	downloadCtx, downloadCancel := context.WithTimeout(context.Background(), procexec.InstallTimeout)
	defer downloadCancel()

	downloadCmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-Command",
		fmt.Sprintf("Invoke-WebRequest -Uri '%s' -OutFile '%s'", escapePowerShellSingleQuoted(url), escapePowerShellSingleQuoted(installerPath)),
	)
	downloadOutput, err := procexec.CombinedOutput(downloadCtx, downloadCmd)
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("download failed: %v (%s)", err, strings.TrimSpace(downloadOutput))}
	}

	installCtx, installCancel := context.WithTimeout(context.Background(), procexec.InstallTimeout)
	defer installCancel()

	installCmd := exec.Command(installerPath, "/quiet", "/norestart")
	installOutput, err := procexec.CombinedOutput(installCtx, installCmd)
	if err != nil {
		message := strings.TrimSpace(installOutput)
		if procexec.IsTimeout(err) {
			return Result{Success: false, Message: procexec.InstallTimeoutMessage}
		}
		return Result{Success: false, Message: fmt.Sprintf("install failed: %v (%s)", err, message)}
	}
	return Result{Success: true, Message: "installer launched successfully"}
}

func escapePowerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}
