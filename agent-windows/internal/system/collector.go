// Package system collects machine inventory and runs local commands.
package system

import (
	"fmt"
	"math"
	"os"
	"strings"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/yusufpapurcu/wmi"
)

// WindowsUpdateItem is a pending or installed Windows update entry.
type WindowsUpdateItem struct {
	Title       string `json:"title"`
	KB          string `json:"kb,omitempty"`
	InstalledOn string `json:"installed_on,omitempty"`
}

// DeviceInfo holds inventory fields reported to the MDM server.
type DeviceInfo struct {
	Hostname                     string                  `json:"hostname"`
	OSVersion                    string                  `json:"os_version"`
	CPU                          string                  `json:"cpu"`
	CPUCores                     int                     `json:"cpu_cores,omitempty"`
	CPUThreads                   int                     `json:"cpu_threads,omitempty"`
	CPUFrequencyGHz              float64                 `json:"cpu_frequency_ghz,omitempty"`
	RAM_GB                       int                     `json:"ram_gb"`
	DiskTotal_GB      int                     `json:"disk_total_gb"`
	DiskUsed_GB       int                     `json:"disk_used_gb"`
	Manufacturer      string                  `json:"manufacturer,omitempty"`
	Model             string                  `json:"model,omitempty"`
	SerialNumber      string                  `json:"serial_number,omitempty"`
	CurrentUser       string                  `json:"current_user,omitempty"`
	UptimeSeconds     int64                   `json:"uptime_seconds,omitempty"`
	AntivirusName                string                  `json:"antivirus_name,omitempty"`
	AntivirusActive              bool                    `json:"antivirus_active"`
	AntivirusDefinitionsUpdated  string                  `json:"antivirus_definitions_updated,omitempty"`
	Latitude          float64                 `json:"latitude,omitempty"`
	Longitude         float64                 `json:"longitude,omitempty"`
	LocalIP           string                  `json:"local_ip,omitempty"`
	PublicIP          string                  `json:"public_ip,omitempty"`
	WifiBSSID         string                  `json:"wifi_bssid,omitempty"`
	PendingUpdates               int                     `json:"pending_updates,omitempty"`
	LastUpdateCheck              string                  `json:"last_update_check,omitempty"`
	PendingUpdatesList           []WindowsUpdateItem     `json:"pending_updates_list,omitempty"`
	InstalledUpdatesList         []WindowsUpdateItem     `json:"installed_updates_list,omitempty"`
	BitLockerKey      string                  `json:"bitlocker_key,omitempty"`
	DiskEncrypted     bool                    `json:"disk_encrypted"`
	EncryptionStatus  string                  `json:"encryption_status,omitempty"`
	Disks             []DiskVolumeInfo        `json:"disks,omitempty"`
	LocalUsers        []LocalUserInfo         `json:"local_users,omitempty"`
	InstalledSoftware []InstalledSoftwareInfo `json:"installed_software,omitempty"`
}

// Collector gathers hardware and OS information from the local machine.
type Collector struct{}

// NewCollector returns a system information collector.
func NewCollector() *Collector {
	return &Collector{}
}

type win32BaseBoard struct {
	SerialNumber string
	Product      string
	Manufacturer string
}

// GetHardwareID returns a stable machine identifier that survives reboots.
func GetHardwareID() (string, error) {
	hostInfo, err := host.Info()
	if err != nil {
		return "", fmt.Errorf("host info: %w", err)
	}

	if id := strings.TrimSpace(hostInfo.HostID); id != "" {
		return id, nil
	}

	var boards []win32BaseBoard
	if err := wmi.Query("SELECT SerialNumber FROM Win32_BaseBoard", &boards); err != nil {
		return "", fmt.Errorf("wmi baseboard: %w", err)
	}

	for _, board := range boards {
		if serial := strings.TrimSpace(board.SerialNumber); serial != "" {
			return serial, nil
		}
	}

	return "", fmt.Errorf("hardware id unavailable")
}

// CollectInfo reads hostname, OS, CPU, memory, and system disk usage.
func CollectInfo() (*DeviceInfo, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return nil, fmt.Errorf("hostname: %w", err)
	}

	hostInfo, err := host.Info()
	if err != nil {
		return nil, fmt.Errorf("host info: %w", err)
	}

	cpuModel, cpuCores, cpuThreads, cpuFrequencyGHz, err := collectCPUInfo()
	if err != nil {
		return nil, fmt.Errorf("cpu: %w", err)
	}

	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("memory: %w", err)
	}

	diskVolumes := collectDiskVolumes()
	primaryDisk, encryptionStatus, diskEncrypted := summarizeDiskEncryption(diskVolumes)

	manufacturer, model, serialNumber, currentUser, localUsers, installedSoftware, err := collectExtendedInventory()
	if err != nil {
		return nil, fmt.Errorf("extended inventory: %w", err)
	}

	uptimeSeconds := collectUptimeSeconds()
	antivirusName, antivirusActive := collectAntivirusStatus()
	antivirusDefinitionsUpdated := collectAntivirusDefinitionsUpdated()
	latitude, longitude, wifiBSSID := collectLocationInfo()
	localIP := collectLocalIPv4()
	pendingUpdates, lastUpdateCheck, pendingUpdatesList, installedUpdatesList := collectWindowsUpdateInfo()
	bitLockerKey := collectBitLockerRecoveryKey()

	return &DeviceInfo{
		Hostname:                    hostname,
		OSVersion:                   formatOSVersion(hostInfo),
		CPU:                         cpuModel,
		CPUCores:                    cpuCores,
		CPUThreads:                  cpuThreads,
		CPUFrequencyGHz:             cpuFrequencyGHz,
		RAM_GB:                      bytesToRoundedGB(memInfo.Total),
		DiskTotal_GB:      primaryDisk.Total_GB,
		DiskUsed_GB:       primaryDisk.Used_GB,
		UptimeSeconds:               uptimeSeconds,
		AntivirusName:               antivirusName,
		AntivirusActive:             antivirusActive,
		AntivirusDefinitionsUpdated: antivirusDefinitionsUpdated,
		Latitude:          latitude,
		Longitude:         longitude,
		LocalIP:           localIP,
		WifiBSSID:         wifiBSSID,
		PendingUpdates:              pendingUpdates,
		LastUpdateCheck:             lastUpdateCheck,
		PendingUpdatesList:          pendingUpdatesList,
		InstalledUpdatesList:        installedUpdatesList,
		BitLockerKey:      bitLockerKey,
		DiskEncrypted:     diskEncrypted,
		EncryptionStatus:  encryptionStatus,
		Disks:             diskVolumes,
		Manufacturer:      manufacturer,
		Model:             model,
		SerialNumber:      serialNumber,
		CurrentUser:       currentUser,
		LocalUsers:        localUsers,
		InstalledSoftware: installedSoftware,
	}, nil
}

func collectCPUInfo() (model string, cores int, threads int, frequencyGHz float64, err error) {
	cpus, err := cpu.Info()
	if err != nil {
		return "", 0, 0, 0, err
	}
	if len(cpus) == 0 {
		return "", 0, 0, 0, fmt.Errorf("no CPU information available")
	}

	model = cpus[0].ModelName

	physicalCores, _ := cpu.Counts(false)
	logicalThreads, _ := cpu.Counts(true)
	cores = physicalCores
	threads = logicalThreads
	cores, threads = reconcileCPUCounts(cores, threads)

	if cpus[0].Mhz > 0 {
		frequencyGHz = cpus[0].Mhz / 1000
	}
	return model, cores, threads, frequencyGHz, nil
}

func collectSystemDiskUsage() (*disk.UsageStat, error) {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil, err
	}

	for _, part := range partitions {
		if part.Mountpoint == "C:" || part.Mountpoint == `C:\` {
			return disk.Usage(part.Mountpoint)
		}
	}

	for _, part := range partitions {
		usage, err := disk.Usage(part.Mountpoint)
		if err != nil {
			continue
		}
		return usage, nil
	}

	return nil, fmt.Errorf("no accessible disk partitions found")
}

func formatOSVersion(info *host.InfoStat) string {
	if info.PlatformVersion != "" {
		return fmt.Sprintf("%s / Build %s", info.Platform, info.PlatformVersion)
	}
	return info.Platform
}

func bytesToRoundedGB(bytes uint64) int {
	gb := float64(bytes) / (1024 * 1024 * 1024)
	return int(math.Round(gb))
}
