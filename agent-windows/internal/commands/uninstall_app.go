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

	uninstallString := normalizeUninstallString(req.UninstallString)
	if uninstallString == "" {
		return Result{Success: false, Message: "No uninstall string available"}
	}

	prepared := prepareUninstallCommand(uninstallString)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd, executionLine := buildUninstallCommand(ctx, prepared)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	logLine := fmt.Sprintf(
		"App: %s\nPrepared command: %s\nExecution: %s",
		strings.TrimSpace(req.AppName),
		prepared,
		executionLine,
	)

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

func buildUninstallCommand(ctx context.Context, prepared string) (*exec.Cmd, string) {
	if exe, args, ok := parseUninstallCommandLine(prepared); ok {
		exe = strings.TrimSpace(strings.Trim(exe, `"`))
		if exe != "" {
			executionLine := exe
			if len(args) > 0 {
				executionLine = exe + " " + strings.Join(args, " ")
			}
			return exec.CommandContext(ctx, exe, args...), executionLine
		}
	}

	return exec.CommandContext(ctx, "cmd.exe", "/S", "/C", prepared), "cmd.exe /S /C " + prepared
}

func normalizeUninstallString(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}

	s = strings.ReplaceAll(s, `\"`, `"`)
	s = strings.ReplaceAll(s, `\\`, `\`)

	if len(s) >= 2 && s[0] == '\'' && s[len(s)-1] == '\'' {
		s = strings.TrimSpace(s[1 : len(s)-1])
	}

	return strings.TrimSpace(s)
}

func prepareUninstallCommand(raw string) string {
	line := normalizeUninstallString(raw)
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

func parseUninstallCommandLine(line string) (exe string, args []string, ok bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return "", nil, false
	}

	if strings.HasPrefix(line, `"`) {
		closeQuote := strings.Index(line[1:], `"`)
		if closeQuote >= 0 {
			exe = line[1 : closeQuote+1]
			rest := strings.TrimSpace(line[closeQuote+2:])
			if rest == "" {
				return exe, nil, true
			}
			return exe, splitCommandArgs(rest), true
		}
	}

	parts := splitCommandArgs(line)
	if len(parts) == 0 {
		return "", nil, false
	}
	if len(parts) == 1 {
		return parts[0], nil, true
	}
	return parts[0], parts[1:], true
}

func splitCommandArgs(s string) []string {
	var args []string
	var current strings.Builder
	inQuotes := false

	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '"':
			inQuotes = !inQuotes
		case ' ':
			if inQuotes {
				current.WriteByte(s[i])
				continue
			}
			if current.Len() > 0 {
				args = append(args, strings.Trim(current.String(), `"`))
				current.Reset()
			}
		default:
			current.WriteByte(s[i])
		}
	}

	if current.Len() > 0 {
		args = append(args, strings.Trim(current.String(), `"`))
	}
	return args
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
