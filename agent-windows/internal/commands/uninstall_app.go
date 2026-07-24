//go:build windows

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"syscall"
	"time"
)

var msiInstallFlagPattern = regexp.MustCompile(`(?i)/I([^\s"]*)`)

type uninstallAppPayload struct {
	AppName         string `json:"appName"`
	UninstallString string `json:"uninstallString"`
}

func uninstallApp(payload string) Result {
	var req uninstallAppPayload
	if err := json.Unmarshal([]byte(strings.TrimSpace(payload)), &req); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("invalid payload: %v", err)}
	}

	uninstallString := strings.TrimSpace(req.UninstallString)
	if uninstallString == "" {
		return Result{Success: false, Message: "No uninstall string available"}
	}

	prepared := prepareUninstallCommand(uninstallString)
	logLine := fmt.Sprintf("App: %s\nPrepared command: %s", strings.TrimSpace(req.AppName), prepared)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "cmd.exe", "/c", prepared)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := captureCommandOutput(cmd)
	combined := strings.TrimSpace(logLine + "\n\n" + output)
	if err != nil {
		if combined == logLine {
			combined = logLine + "\n\n" + err.Error()
		}
		return Result{Success: false, Message: combined}
	}
	if strings.TrimSpace(output) == "" {
		output = "uninstall command completed"
		combined = strings.TrimSpace(logLine + "\n\n" + output)
	}
	return Result{Success: true, Message: combined}
}

func prepareUninstallCommand(raw string) string {
	line := strings.TrimSpace(raw)
	if line == "" {
		return line
	}

	if isMsiExecCommand(line) {
		line = msiInstallFlagPattern.ReplaceAllString(line, "/X$1")
		line = ensureMsiQuietFlags(line)
		return line
	}

	if !hasSilentUninstallFlag(line) {
		line = appendSilentUninstallFlags(line)
	}
	return line
}

func isMsiExecCommand(line string) bool {
	lower := strings.ToLower(line)
	return strings.Contains(lower, "msiexec.exe") || strings.Contains(lower, " msiexec ")
}

func ensureMsiQuietFlags(line string) string {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "/quiet") || strings.Contains(lower, "/qn") || strings.Contains(lower, "/q ") {
		if !strings.Contains(lower, "/norestart") {
			return strings.TrimSpace(line + " /norestart")
		}
		return line
	}
	return strings.TrimSpace(line + " /quiet /norestart")
}

func hasSilentUninstallFlag(line string) bool {
	lower := strings.ToLower(line)
	flags := []string{
		"/s", "/silent", "/verysilent", "/quiet", "/qn",
		"-s", "-silent", "/suppressmsgboxes", "/norestart",
	}
	for _, flag := range flags {
		if strings.Contains(lower, flag) {
			return true
		}
	}
	return false
}

func appendSilentUninstallFlags(line string) string {
	lower := strings.ToLower(line)
	if strings.Contains(lower, "unins") || strings.Contains(lower, "setup") || strings.Contains(lower, "install") {
		return strings.TrimSpace(line + " /VERYSILENT /SUPPRESSMSGBOXES /NORESTART")
	}
	return strings.TrimSpace(line + " /S")
}
