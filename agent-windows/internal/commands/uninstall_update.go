//go:build windows

package commands

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/procexec"
)

var kbDigitsPattern = regexp.MustCompile(`[0-9]+`)

// ExecuteDeviceCommand runs a DeviceCommandLog action and returns combined console output.
func ExecuteDeviceCommand(commandName, payload string) Result {
	switch commandName {
	case "sync":
		return executeSyncInventory()
	case "apply_configuration":
		return executeApplyConfiguration()
	case "UninstallUpdate":
		return uninstallWindowsUpdate(payload)
	case "powershell":
		return ExecutePowerShellScript(payload)
	case "battery_report":
		return batteryReport()
	case "install_windows_update":
		return installWindowsUpdate(payload)
	case "UninstallApp":
		return uninstallApp(payload)
	case "manage_local_group":
		return manageLocalGroupFromString(payload)
	case "wipe", "factory_reset":
		return factoryWipe()
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

	ctx, cancel := context.WithTimeout(context.Background(), procexec.InstallTimeout)
	defer cancel()

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)

	output, err := captureCommandOutput(ctx, cmd)
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

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script)

	output, err := captureCommandOutput(ctx, cmd)
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

func captureCommandOutput(ctx context.Context, cmd *exec.Cmd) (string, error) {
	result, err := procexec.Run(ctx, cmd, true)

	var parts []string
	if result.Stdout != "" {
		parts = append(parts, result.Stdout)
	}
	if result.Stderr != "" {
		parts = append(parts, result.Stderr)
	}
	combined := strings.TrimSpace(strings.Join(parts, "\n"))
	if len(combined) > 16000 {
		combined = combined[:16000] + "..."
	}

	if procexec.IsTimeout(err) {
		if combined != "" {
			combined += "\n"
		}
		combined += procexec.InstallTimeoutMessage
		return combined, fmt.Errorf("%s", procexec.InstallTimeoutMessage)
	}
	if err != nil {
		return combined, err
	}
	return combined, nil
}

func batteryReport() Result {
	tempDir := os.TempDir()
	outputPath := filepath.Join(tempDir, "battery_report.html")

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	cmd := exec.Command("cmd.exe", "/c", fmt.Sprintf("powercfg /batteryreport /output %s", outputPath))
	if output, err := captureCommandOutput(ctx, cmd); err != nil {
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
