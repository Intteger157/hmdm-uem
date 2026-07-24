//go:build windows

package apps

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/procexec"
)

const (
	exitCodeSuccessRebootRequired = 3010
	installProcessTimeout         = procexec.InstallTimeout
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
		return runPreparedInstaller(cmd, cmdLine, installProcessTimeout, true)
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
		if procexec.IsTimeout(err) || strings.Contains(err.Error(), procexec.InstallTimeoutMessage) {
			break
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
	cmd, _ := buildInstallerCommandWithArgs(installerPath, args)
	return runPreparedInstaller(cmd, cmdLine, installProcessTimeout, false)
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

func runPreparedInstaller(cmd *exec.Cmd, cmdLine string, timeout time.Duration, captureOutput bool) (installRunResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	execPath := cmd.Path
	if execPath == "" && len(cmd.Args) > 0 {
		execPath = cmd.Args[0]
	}
	var execArgs []string
	if len(cmd.Args) > 1 {
		execArgs = cmd.Args[1:]
	}

	wrapped := exec.Command(execPath, execArgs...)
	wrapped.Dir = cmd.Dir
	wrapped.Env = cmd.Env

	runResult, err := procexec.Run(ctx, wrapped, captureOutput)
	result := installRunResult{
		ExitCode:    runResult.ExitCode,
		CommandLine: cmdLine,
		Stdout:      runResult.Stdout,
		Stderr:      runResult.Stderr,
	}

	if procexec.IsTimeout(err) {
		if result.Stderr != "" {
			result.Stderr += "\n"
		}
		result.Stderr += procexec.InstallTimeoutMessage
		if result.ExitCode == 0 {
			result.ExitCode = -1
		}
		return result, fmt.Errorf("installer timed out: %s", formatInstallResult(result))
	}

	if isInstallerSuccess(result.ExitCode) {
		return result, nil
	}

	if err != nil {
		return result, fmt.Errorf("installer failed: %s", formatInstallResult(result))
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
