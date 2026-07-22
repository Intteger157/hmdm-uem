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

// DeviceInfo holds inventory fields reported to the MDM server.
type DeviceInfo struct {
	Hostname          string                  `json:"hostname"`
	OSVersion         string                  `json:"os_version"`
	CPU               string                  `json:"cpu"`
	RAM_GB            int                     `json:"ram_gb"`
	DiskTotal_GB      int                     `json:"disk_total_gb"`
	DiskUsed_GB       int                     `json:"disk_used_gb"`
	Manufacturer      string                  `json:"manufacturer,omitempty"`
	Model             string                  `json:"model,omitempty"`
	SerialNumber      string                  `json:"serial_number,omitempty"`
	CurrentUser       string                  `json:"current_user,omitempty"`
	DiskEncrypted     bool                    `json:"disk_encrypted"`
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

	cpuModel, err := collectCPUModel()
	if err != nil {
		return nil, fmt.Errorf("cpu: %w", err)
	}

	memInfo, err := mem.VirtualMemory()
	if err != nil {
		return nil, fmt.Errorf("memory: %w", err)
	}

	diskUsage, err := collectSystemDiskUsage()
	if err != nil {
		return nil, fmt.Errorf("disk: %w", err)
	}

	manufacturer, model, serialNumber, currentUser, diskEncrypted, localUsers, installedSoftware, err := collectExtendedInventory()
	if err != nil {
		return nil, fmt.Errorf("extended inventory: %w", err)
	}

	return &DeviceInfo{
		Hostname:          hostname,
		OSVersion:         formatOSVersion(hostInfo),
		CPU:               cpuModel,
		RAM_GB:            bytesToRoundedGB(memInfo.Total),
		DiskTotal_GB:      bytesToRoundedGB(diskUsage.Total),
		DiskUsed_GB:       bytesToRoundedGB(diskUsage.Used),
		Manufacturer:      manufacturer,
		Model:             model,
		SerialNumber:      serialNumber,
		CurrentUser:       currentUser,
		DiskEncrypted:     diskEncrypted,
		LocalUsers:        localUsers,
		InstalledSoftware: installedSoftware,
	}, nil
}

func collectCPUModel() (string, error) {
	cpus, err := cpu.Info()
	if err != nil {
		return "", err
	}
	if len(cpus) == 0 {
		return "", fmt.Errorf("no CPU information available")
	}
	return cpus[0].ModelName, nil
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
