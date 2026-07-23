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
	PendingUpdates       int
	LastUpdateCheck      string
	PendingUpdatesList   []WindowsUpdateItem
	InstalledUpdatesList []WindowsUpdateItem
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

func collectWindowsUpdateInfo() (pendingUpdates int, lastUpdateCheck string, pendingList, installedList []WindowsUpdateItem) {
	script := `
$ErrorActionPreference = 'SilentlyContinue'
$pendingCount = 0
$pendingList = @()
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and Type='Software'")
  $pendingCount = [int]$result.Updates.Count
  foreach ($update in $result.Updates) {
    $kb = ''
    if ($update.KBArticleIDs.Count -gt 0) {
      $kb = 'KB' + $update.KBArticleIDs.Item(0)
    }
    $pendingList += [pscustomobject]@{
      Title = [string]$update.Title
      KB = $kb
    }
  }
} catch {}

$installedList = @()
Get-HotFix -ErrorAction SilentlyContinue |
  Sort-Object InstalledOn -Descending |
  Select-Object -First 50 |
  ForEach-Object {
    $installedOn = ''
    if ($null -ne $_.InstalledOn) {
      $installedOn = $_.InstalledOn.ToString('o')
    }
    $installedList += [pscustomobject]@{
      Title = [string]$_.Description
      KB = [string]$_.HotFixID
      InstalledOn = $installedOn
    }
  }

$lastCheck = ''
$detect = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\Results\Detect' -ErrorAction SilentlyContinue
if ($null -ne $detect -and $detect.LastSuccessTime) {
  $lastCheck = $detect.LastSuccessTime.ToString('o')
}

[pscustomobject]@{
  PendingUpdates = $pendingCount
  LastUpdateCheck = $lastCheck
  PendingUpdatesList = $pendingList
  InstalledUpdatesList = $installedList
} | ConvertTo-Json -Compress -Depth 4
`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return 0, "", nil, nil
	}

	var info windowsUpdateInfo
	if err := json.Unmarshal(output, &info); err != nil {
		return 0, "", nil, nil
	}
	return info.PendingUpdates, strings.TrimSpace(info.LastUpdateCheck), info.PendingUpdatesList, info.InstalledUpdatesList
}

func collectBitLockerRecoveryKey() string {
	script := `$WarningPreference = 'SilentlyContinue'; (Get-BitLockerVolume -MountPoint C).KeyProtector | Where-Object {$_.KeyProtectorType -eq 'RecoveryPassword'} | Select-Object -ExpandProperty RecoveryPassword`

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
