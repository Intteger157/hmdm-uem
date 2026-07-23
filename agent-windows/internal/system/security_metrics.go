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

type antivirusProduct struct {
	DisplayName  string
	ProductState uint32
}

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
	if defenderName, defenderActive := collectDefenderStatus(); defenderName != "" {
		return defenderName, defenderActive
	}
	return collectAntivirusFromWMI()
}

func collectDefenderStatus() (string, bool) {
	script := `$s = Get-MpComputerStatus -ErrorAction SilentlyContinue; if ($null -eq $s) { exit 2 }; [pscustomobject]@{ Name = 'Windows Defender'; RealTimeProtectionEnabled = [bool]$s.RealTimeProtectionEnabled; AntivirusEnabled = [bool]$s.AntivirusEnabled } | ConvertTo-Json -Compress`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", false
	}

	var parsed struct {
		Name                      string `json:"Name"`
		RealTimeProtectionEnabled bool   `json:"RealTimeProtectionEnabled"`
		AntivirusEnabled          bool   `json:"AntivirusEnabled"`
	}
	if err := json.Unmarshal(output, &parsed); err != nil {
		return "", false
	}
	active := parsed.RealTimeProtectionEnabled || parsed.AntivirusEnabled
	return strings.TrimSpace(parsed.Name), active
}

func collectAntivirusFromWMI() (string, bool) {
	var products []antivirusProduct
	err := wmi.Query("SELECT displayName, productState FROM AntiVirusProduct", &products, "root\\SecurityCenter2")
	if err != nil || len(products) == 0 {
		return "", false
	}

	bestName := ""
	bestActive := false
	for _, product := range products {
		displayName := strings.TrimSpace(product.DisplayName)
		if displayName == "" {
			continue
		}
		active := (product.ProductState & 0x1000) == 0x1000
		if bestName == "" || active {
			bestName = displayName
			bestActive = active
		}
		if active {
			break
		}
	}
	return bestName, bestActive
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
