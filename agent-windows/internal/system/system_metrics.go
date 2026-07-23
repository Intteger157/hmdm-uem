//go:build windows

package system

import (
	"encoding/json"
	"net"
	"os/exec"
	"strings"
	"syscall"
)

type windowsUpdateInfo struct {
	PendingUpdates  int
	LastUpdateCheck string
}

func collectLocalIPv4() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.IsLoopback() {
				continue
			}
			if ip4 := ipNet.IP.To4(); ip4 != nil {
				return ip4.String()
			}
		}
	}

	return ""
}

func collectWindowsUpdateInfo() (pendingUpdates int, lastUpdateCheck string) {
	script := `
$ErrorActionPreference = 'SilentlyContinue'
$pending = 0
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and Type='Software'")
  $pending = [int]$result.Updates.Count
} catch {}

$lastCheck = ''
$detect = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Detect' -ErrorAction SilentlyContinue
if ($null -ne $detect -and $detect.LastSuccessTime) {
  $lastCheck = $detect.LastSuccessTime.ToString('o')
}

[pscustomobject]@{
  PendingUpdates = $pending
  LastUpdateCheck = $lastCheck
} | ConvertTo-Json -Compress
`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return 0, ""
	}

	var info windowsUpdateInfo
	if err := json.Unmarshal(output, &info); err != nil {
		return 0, ""
	}
	return info.PendingUpdates, strings.TrimSpace(info.LastUpdateCheck)
}

func collectBitLockerRecoveryKey() string {
	script := `
$ErrorActionPreference = 'SilentlyContinue'
Import-Module BitLocker -ErrorAction SilentlyContinue
$volume = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction SilentlyContinue
if ($null -eq $volume) { exit 2 }
$key = $volume.KeyProtector |
  Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' } |
  Select-Object -First 1 -ExpandProperty RecoveryPassword
if ([string]::IsNullOrWhiteSpace($key)) { exit 2 }
$key
`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
