//go:build windows

package commands

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"syscall"
	"time"
)

var kbDigitsPattern = regexp.MustCompile(`[0-9]+`)

// ExecuteDeviceCommand runs a DeviceCommandLog action and returns combined console output.
func ExecuteDeviceCommand(commandName, payload string) Result {
	switch commandName {
	case "UninstallUpdate":
		return uninstallWindowsUpdate(payload)
	case "powershell":
		return ExecutePowerShellScript(payload)
	case "battery_report":
		return batteryReport()
	case "install_windows_update":
		return installWindowsUpdate(payload)
	default:
		return Result{Success: false, Message: fmt.Sprintf("unsupported command: %s", commandName)}
	}
}

func uninstallWindowsUpdate(kb string) Result {
	kb = strings.TrimSpace(kb)
	if kb == "" || !kbDigitsPattern.MatchString(kb) {
		return Result{Success: false, Message: "invalid KB payload"}
	}

	script := fmt.Sprintf(
		`$ErrorActionPreference = 'Stop'; $kb = '%s' -replace '[^0-9]', ''; $Pkg = Get-WindowsPackage -Online | Where-Object { $_.PackageName -match $kb }; if ($Pkg) { Write-Output 'Found via DISM, removing...'; Remove-WindowsPackage -Online -PackageName $Pkg[0].PackageName -NoRestart } else { Write-Output 'Not found in DISM. Attempting WUSA fallback...'; Start-Process -FilePath "wusa.exe" -ArgumentList "/uninstall /kb:$kb /quiet /norestart" -Wait -NoNewWindow; Write-Output 'WUSA fallback executed.' }`,
		escapePowerShellSingleQuoted(kb),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := captureCommandOutput(cmd)
	if err != nil {
		if strings.TrimSpace(output) == "" {
			output = err.Error()
		}
		return Result{Success: false, Message: output}
	}
	if strings.TrimSpace(output) == "" {
		output = "update uninstall command completed"
	}
	return Result{Success: true, Message: output}
}

func installWindowsUpdate(kb string) Result {
	kb = strings.TrimSpace(kb)
	if kb == "" || !kbDigitsPattern.MatchString(kb) {
		return Result{Success: false, Message: "invalid KB payload"}
	}

	script := fmt.Sprintf(`
$ErrorActionPreference = 'Stop'
$KB = '%s'
$Session = New-Object -ComObject Microsoft.Update.Session
$Searcher = $Session.CreateUpdateSearcher()
$Result = $Searcher.Search("IsInstalled=0 and Type='Software'")
$Update = $Result.Updates | Where-Object { $_.Title -match $KB }
if ($Update) {
    $Downloader = $Session.CreateUpdateDownloader()
    $Downloader.Updates = New-Object -ComObject Microsoft.Update.UpdateColl
    $Downloader.Updates.Add($Update)
    $Downloader.Download()
    $Installer = $Session.CreateUpdateInstaller()
    $Installer.Updates = $Downloader.Updates
    $InstallResult = $Installer.Install()
    Write-Output "Install ResultCode: $($InstallResult.ResultCode)"
} else {
    Write-Output "Update $KB not found in pending list."
}
`, escapePowerShellSingleQuoted(kb))

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := captureCommandOutput(cmd)
	output = strings.TrimSpace(output)
	if err != nil {
		if output == "" {
			output = err.Error()
		}
		return Result{Success: false, Message: output}
	}
	if output == "" {
		output = "install windows update command completed"
	}
	if strings.Contains(output, "not found in pending list") {
		return Result{Success: false, Message: output}
	}
	if strings.Contains(output, "ResultCode: 2") || strings.Contains(output, "ResultCode: 3") {
		return Result{Success: true, Message: output}
	}
	if strings.Contains(output, "ResultCode:") {
		return Result{Success: false, Message: output}
	}
	return Result{Success: true, Message: output}
}

func captureCommandOutput(cmd *exec.Cmd) (string, error) {
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return "", err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return "", err
	}

	if err := cmd.Start(); err != nil {
		return "", err
	}

	stdoutBytes, _ := io.ReadAll(io.LimitReader(stdoutPipe, 512*1024))
	stderrBytes, _ := io.ReadAll(io.LimitReader(stderrPipe, 512*1024))
	runErr := cmd.Wait()

	var parts []string
	if len(stdoutBytes) > 0 {
		parts = append(parts, strings.TrimSpace(string(stdoutBytes)))
	}
	if len(stderrBytes) > 0 {
		parts = append(parts, strings.TrimSpace(string(stderrBytes)))
	}
	combined := strings.TrimSpace(strings.Join(parts, "\n"))
	if len(combined) > 16000 {
		combined = combined[:16000] + "..."
	}
	return combined, runErr
}

func batteryReport() Result {
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "battery_report.html")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, "cmd.exe", "/c", fmt.Sprintf("powercfg /batteryreport /output %s", outputPath))
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := captureCommandOutput(cmd); err != nil {
		message := strings.TrimSpace(output)
		if message == "" {
			message = err.Error()
		}
		return Result{Success: false, Message: message}
	}

	html, err := os.ReadFile(outputPath)
	_ = os.Remove(outputPath)
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("read battery report: %v", err)}
	}

	content := string(html)
	if strings.TrimSpace(content) == "" {
		return Result{Success: false, Message: "battery report file is empty"}
	}
	if len(content) > 512*1024 {
		content = content[:512*1024] + "\n<!-- truncated -->"
	}
	return Result{Success: true, Message: content}
}
