//go:build windows

package apps

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

const exitCodeSuccessRebootRequired = 3010

var exeSilentArgSets = [][]string{
	{"/S"},
	{"/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"},
	{"/quiet", "/norestart"},
}

type installRunResult struct {
	ExitCode    int
	CommandLine string
	Stdout      string
	Stderr      string
}

func isInstallerSuccess(exitCode int) bool {
	return exitCode == 0 || exitCode == exitCodeSuccessRebootRequired
}

func runURLInstaller(installerPath, installArgs string) (installRunResult, error) {
	customArgs := strings.TrimSpace(installArgs)
	if customArgs != "" {
		cmd, cmdLine := buildInstallerCommand(installerPath, customArgs)
		return runPreparedInstaller(cmd, cmdLine)
	}

	ext := strings.ToLower(filepath.Ext(installerPath))
	if ext == ".msi" {
		cmd, cmdLine := buildInstallerCommand(installerPath, "")
		return runPreparedInstaller(cmd, cmdLine)
	}

	var lastResult installRunResult
	var lastErr error
	for _, args := range exeSilentArgSets {
		cmd, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		result, err := runPreparedInstaller(cmd, cmdLine)
		lastResult = result
		lastErr = err
		if err == nil {
			return result, nil
		}
	}
	return lastResult, lastErr
}

func buildInstallerCommand(installerPath, installArgs string) (*exec.Cmd, string) {
	args := strings.Fields(strings.TrimSpace(installArgs))
	return buildInstallerCommandWithArgs(installerPath, args)
}

func buildInstallerCommandWithArgs(installerPath string, args []string) (*exec.Cmd, string) {
	ext := strings.ToLower(filepath.Ext(installerPath))

	switch ext {
	case ".msi":
		if len(args) == 0 {
			args = []string{"/quiet", "/norestart"}
		}
		msiArgs := append([]string{"/i", installerPath}, args...)
		cmdLine := fmt.Sprintf(`msiexec.exe %s`, strings.Join(quoteCommandParts(msiArgs), " "))
		return exec.Command("msiexec.exe", msiArgs...), cmdLine
	default:
		if len(args) == 0 {
			args = []string{"/S"}
		}
		cmdLine := fmt.Sprintf(`"%s" %s`, installerPath, strings.Join(quoteCommandParts(args), " "))
		return exec.Command(installerPath, args...), cmdLine
	}
}

func runPreparedInstaller(cmd *exec.Cmd, cmdLine string) (installRunResult, error) {
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	runErr := cmd.Run()
	result := installRunResult{
		ExitCode:    commandExitCode(cmd, runErr),
		CommandLine: cmdLine,
		Stdout:      strings.TrimSpace(stdout.String()),
		Stderr:      strings.TrimSpace(stderr.String()),
	}

	if isInstallerSuccess(result.ExitCode) {
		return result, nil
	}

	return result, fmt.Errorf("installer failed: %s", formatInstallResult(result))
}

func formatInstallResult(result installRunResult) string {
	var b strings.Builder
	if result.CommandLine != "" {
		b.WriteString("Command: ")
		b.WriteString(result.CommandLine)
		b.WriteString("\n")
	}
	b.WriteString(fmt.Sprintf("ExitCode: %d\n", result.ExitCode))
	if result.Stdout != "" {
		b.WriteString("Stdout:\n")
		b.WriteString(result.Stdout)
		b.WriteString("\n")
	}
	if result.Stderr != "" {
		b.WriteString("Stderr:\n")
		b.WriteString(result.Stderr)
	}
	return strings.TrimSpace(b.String())
}

func commandExitCode(cmd *exec.Cmd, runErr error) int {
	if cmd != nil && cmd.ProcessState != nil {
		return cmd.ProcessState.ExitCode()
	}
	if runErr == nil {
		return 0
	}
	if exitErr, ok := runErr.(*exec.ExitError); ok {
		return exitErr.ExitCode()
	}
	return -1
}

func quoteCommandParts(parts []string) []string {
	quoted := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.ContainsAny(part, " \t\"") {
			quoted = append(quoted, fmt.Sprintf(`"%s"`, part))
			continue
		}
		quoted = append(quoted, part)
	}
	return quoted
}
