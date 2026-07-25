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
	appInstallTimeout             = 20 * time.Minute
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
	ctx, cancel := context.WithTimeout(context.Background(), appInstallTimeout)
	defer cancel()

	ext := strings.ToLower(filepath.Ext(installerPath))
	customArgs := strings.TrimSpace(installArgs)

	if ext == ".msi" {
		args := strings.Fields(customArgs)
		cmd, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		return runPreparedInstaller(ctx, cmd, cmdLine, true)
	}

	if customArgs != "" {
		args := strings.Fields(customArgs)
		_, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		return runEXEInstaller(ctx, installerPath, args, cmdLine)
	}

	var attemptResults []installRunResult
	for _, args := range exeSilentArgSets {
		if ctx.Err() != nil {
			break
		}

		_, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		result, err := runEXEInstaller(ctx, installerPath, args, cmdLine)
		attemptResults = append(attemptResults, result)
		if err == nil {
			return result, nil
		}
		if isInstallTimeout(err) {
			break
		}
	}

	if len(attemptResults) == 0 {
		return installRunResult{}, fmt.Errorf("%s", InstallTimeoutStatusMessage)
	}

	combined := formatInstallAttempts(attemptResults)
	last := attemptResults[len(attemptResults)-1]
	if combined != "" {
		last.Stdout = combined
	}
	if ctx.Err() == context.DeadlineExceeded {
		return last, fmt.Errorf("%s", InstallTimeoutStatusMessage)
	}
	return last, fmt.Errorf("all silent install attempts failed")
}

func runEXEInstaller(ctx context.Context, installerPath string, args []string, cmdLine string) (installRunResult, error) {
	cmd, _ := buildInstallerCommandWithArgs(installerPath, args)
	return runPreparedInstaller(ctx, cmd, cmdLine, false)
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

func runPreparedInstaller(ctx context.Context, cmd *exec.Cmd, cmdLine string, captureOutput bool) (installRunResult, error) {
	execPath := cmd.Path
	if execPath == "" && len(cmd.Args) > 0 {
		execPath = cmd.Args[0]
	}
	var execArgs []string
	if len(cmd.Args) > 1 {
		execArgs = cmd.Args[1:]
	}

	wrapped := exec.CommandContext(ctx, execPath, execArgs...)
	wrapped.Dir = cmd.Dir
	wrapped.Env = cmd.Env

	runResult, err := procexec.Run(ctx, wrapped, captureOutput)
	result := installRunResult{
		ExitCode:    runResult.ExitCode,
		CommandLine: cmdLine,
		Stdout:      runResult.Stdout,
		Stderr:      runResult.Stderr,
	}

	if procexec.IsTimeout(err) || ctx.Err() == context.DeadlineExceeded {
		if result.Stderr != "" {
			result.Stderr += "\n"
		}
		result.Stderr += InstallTimeoutStatusMessage
		if result.ExitCode == 0 {
			result.ExitCode = -1
		}
		return result, fmt.Errorf("%s", InstallTimeoutStatusMessage)
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
