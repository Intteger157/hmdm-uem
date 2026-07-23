//go:build windows

package system

import (
	"encoding/json"
	"io"
	"net/http"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"github.com/shirou/gopsutil/v4/host"
	"github.com/yusufpapurcu/wmi"
)

const defenderProductName = "Windows Defender"

type wifiAdapter struct {
	NetConnectionStatus uint16
	MACAddress          string
}

type ipGeoResponse struct {
	Status string  `json:"status"`
	Lat    float64 `json:"lat"`
	Lon    float64 `json:"lon"`
	Query  string  `json:"query"`
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

func collectLocationInfo() (latitude, longitude float64, publicIP, wifiBSSID string) {
	publicIP = fetchPublicIP()
	wifiBSSID = collectWiFiBSSID()
	if publicIP != "" {
		latitude, longitude = geolocatePublicIP(publicIP)
	}
	return latitude, longitude, publicIP, wifiBSSID
}

func fetchPublicIP() string {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("https://api.ipify.org?format=text")
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(body))
}

func geolocatePublicIP(publicIP string) (float64, float64) {
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/" + publicIP + "?fields=status,lat,lon")
	if err != nil {
		return 0, 0
	}
	defer resp.Body.Close()

	var geo ipGeoResponse
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return 0, 0
	}
	if geo.Status != "success" {
		return 0, 0
	}
	return geo.Lat, geo.Lon
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
