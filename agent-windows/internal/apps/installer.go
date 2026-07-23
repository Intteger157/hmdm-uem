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
	ext := strings.ToLower(filepath.Ext(installerPath))
	customArgs := strings.TrimSpace(installArgs)

	if ext == ".msi" {
		args := strings.Fields(customArgs)
		cmd, cmdLine := buildInstallerCommandWithArgs(installerPath, args)
		return runPreparedInstaller(cmd, cmdLine)
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

func runEXEInstaller(installerPath string, args []string, cmdLine string) (installRunResult, error) {
	script := buildEXEInstallPowerShell(installerPath, args)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	runErr := cmd.Run()
	processOutput := strings.TrimSpace(stdout.String())
	processError := strings.TrimSpace(stderr.String())

	result := installRunResult{
		ExitCode:    commandExitCode(cmd, runErr),
		CommandLine: cmdLine,
		Stdout:      processOutput,
		Stderr:      processError,
	}

	if isInstallerSuccess(result.ExitCode) {
		return result, nil
	}

	return result, fmt.Errorf("installer failed: %s", formatInstallResult(result))
}

func buildEXEInstallPowerShell(installerPath string, args []string) string {
	escapedPath := escapePowerShellSingleQuoted(installerPath)
	argList := formatPowerShellArgumentList(args)

	return fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$installerPath = '%s'
$argList = @(%s)
$stdoutFile = [System.IO.Path]::GetTempFileName()
$stderrFile = [System.IO.Path]::GetTempFileName()
try {
  $process = Start-Process -LiteralPath $installerPath -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
  if ($null -eq $process) {
    [Console]::Error.WriteLine('Start-Process returned null')
    exit 1
  }
  if (Test-Path -LiteralPath $stdoutFile) {
    $stdout = Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue
    if ($stdout) { Write-Output $stdout }
  }
  if (Test-Path -LiteralPath $stderrFile) {
    $stderr = Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue
    if ($stderr) { [Console]::Error.WriteLine($stderr) }
  }
  exit $process.ExitCode
}
finally {
  Remove-Item -LiteralPath $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
}
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
