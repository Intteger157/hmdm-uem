//go:build windows

package system

import (
	"os/exec"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/host"
	"github.com/yusufpapurcu/wmi"
)

const defenderProductName = "Windows Defender"

type wifiAdapter struct {
	NetConnectionStatus uint16
	MACAddress          string
}

func collectUptimeSeconds() int64 {
	info, err := host.Info()
	if err != nil {
		return 0
	}
	return int64(info.Uptime)
}

func collectAntivirusStatus() (name string, active bool) {
	return defenderProductName, collectDefenderRealTimeProtectionEnabled()
}

func collectDefenderRealTimeProtectionEnabled() bool {
	script := `$ErrorActionPreference = 'Stop'; (Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled).ToString()`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	return parseRealTimeProtectionEnabled(string(output), err)
}

func parseRealTimeProtectionEnabled(output string, err error) bool {
	if err != nil {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(output), "true")
}

func collectLocationInfo() (latitude, longitude float64, wifiBSSID string) {
	wifiBSSID = collectWiFiBSSID()
	return latitude, longitude, wifiBSSID
}

func collectWiFiBSSID() string {
	var adapters []wifiAdapter
	err := wmi.Query(
		"SELECT NetConnectionStatus, MACAddress FROM Win32_NetworkAdapter WHERE NetConnectionStatus = 2 AND MACAddress IS NOT NULL",
		&adapters,
	)
	if err != nil {
		return ""
	}
	for _, adapter := range adapters {
		mac := strings.TrimSpace(adapter.MACAddress)
		if mac != "" {
			return mac
		}
	}
	return ""
}
