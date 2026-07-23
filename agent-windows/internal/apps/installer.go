//go:build windows

package apps

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const (
	exitCodeSuccessRebootRequired = 3010
	installProcessTimeout         = 15 * time.Minute
)

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
	ext := strings.ToLower(filepath.Ext(installerPath))
	customArgs := strings.TrimSpace(installArgs)

	if ext == ".msi" {
		args := strings.Fields(customArgs)
		cmd, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		return runPreparedInstallerWithTimeout(cmd, cmdLine, installProcessTimeout)
	}

	if customArgs != "" {
		args := strings.Fields(customArgs)
		_, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		return runEXEInstaller(installerPath, args, cmdLine)
	}

	var attemptResults []installRunResult
	for _, args := range exeSilentArgSets {
		_, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		result, err := runEXEInstaller(installerPath, args, cmdLine)
		attemptResults = append(attemptResults, result)
		if err == nil {
			return result, nil
		}
	}

	combined := formatInstallAttempts(attemptResults)
	last := attemptResults[len(attemptResults)-1]
	if combined != "" {
		last.Stdout = combined
	}
	return last, fmt.Errorf("all silent install attempts failed")
}

func runEXEInstaller(installerPath string, args []string, cmdLine string) (installRunResult, error) {
	script := buildEXEInstallPowerShell(installerPath, args)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	return runPreparedInstallerWithTimeout(cmd, cmdLine, installProcessTimeout)
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

func buildEXEInstallPowerShell(installerPath string, args []string) string {
	escapedPath := escapePowerShellSingleQuoted(installerPath)
	argList := formatPowerShellArgumentList(args)

	// Do not redirect stdout/stderr: many GUI EXE installers hang when streams are redirected.
	return fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$installerPath = '%s'
$argList = @(%s)
$process = Start-Process -FilePath $installerPath -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden
if ($null -eq $process) {
  [Console]::Error.WriteLine('Start-Process returned null')
  exit 1
}
exit $process.ExitCode
`, escapedPath, argList)
}

func escapePowerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func formatPowerShellArgumentList(args []string) string {
	if len(args) == 0 {
		return ""
	}
	quoted := make([]string, len(args))
	for i, arg := range args {
		quoted[i] = "'" + escapePowerShellSingleQuoted(arg) + "'"
	}
	return strings.Join(quoted, ", ")
}

func runPreparedInstallerWithTimeout(cmd *exec.Cmd, cmdLine string, timeout time.Duration) (installRunResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	execPath := cmd.Path
	if execPath == "" && len(cmd.Args) > 0 {
		execPath = cmd.Args[0]
	}
	var execArgs []string
	if len(cmd.Args) > 1 {
		execArgs = cmd.Args[1:]
	} else if execPath != "" && len(cmd.Args) == 1 {
		execArgs = nil
	}

	wrapped := exec.CommandContext(ctx, execPath, execArgs...)
	wrapped.Dir = cmd.Dir
	wrapped.Env = cmd.Env
	wrapped.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	var stdout, stderr bytes.Buffer
	wrapped.Stdout = &stdout
	wrapped.Stderr = &stderr

	runErr := wrapped.Run()
	result := installRunResult{
		ExitCode:    commandExitCode(wrapped, runErr),
		CommandLine: cmdLine,
		Stdout:      strings.TrimSpace(stdout.String()),
		Stderr:      strings.TrimSpace(stderr.String()),
	}

	if ctx.Err() == context.DeadlineExceeded {
		timeoutMessage := fmt.Sprintf("Install timed out after %s", timeout)
		if result.Stderr != "" {
			result.Stderr = result.Stderr + "\n" + timeoutMessage
		} else {
			result.Stderr = timeoutMessage
		}
		if result.ExitCode == 0 {
			result.ExitCode = -1
		}
		return result, fmt.Errorf("installer timed out: %s", formatInstallResult(result))
	}

	if isInstallerSuccess(result.ExitCode) {
		return result, nil
	}

	return result, fmt.Errorf("installer failed: %s", formatInstallResult(result))
}

func formatInstallAttempts(results []installRunResult) string {
	if len(results) == 0 {
		return ""
	}
	sections := make([]string, 0, len(results))
	for _, result := range results {
		sections = append(sections, formatInstallResult(result))
	}
	return strings.Join(sections, "\n\n--- Next attempt ---\n\n")
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
