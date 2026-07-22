//go:build windows

package system

import (
	"os/exec"
	"sort"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/disk"
	"github.com/yusufpapurcu/wmi"
)

// DiskVolumeInfo describes one mounted Windows data volume.
type DiskVolumeInfo struct {
	MountPoint    string `json:"mount_point"`
	Label         string `json:"label,omitempty"`
	Total_GB      int    `json:"total_gb"`
	Used_GB       int    `json:"used_gb"`
	EncryptStatus string `json:"encrypt_status"`
}

type win32LogicalDisk struct {
	DeviceID string
	VolumeName string
	DriveType uint32
}

type win32EncryptableVolumeFull struct {
	DriveLetter      string
	ProtectionStatus uint32
	ConversionStatus uint32
}

// collectDiskVolumes returns fixed local drives with usage and BitLocker status.
func collectDiskVolumes() []DiskVolumeInfo {
	partitions, err := disk.Partitions(false)
	if err != nil {
		return nil
	}

	encryptionByDrive := collectEncryptionByDriveLetter()
	volumes := make([]DiskVolumeInfo, 0, len(partitions))
	seen := make(map[string]struct{})

	for _, part := range partitions {
		mount := normalizeDriveLetter(part.Mountpoint)
		if mount == "" {
			continue
		}
		if _, exists := seen[mount]; exists {
			continue
		}
		if !isFixedDataVolume(mount) {
			continue
		}

		usage, err := disk.Usage(part.Mountpoint)
		if err != nil || usage.Total == 0 {
			continue
		}

		seen[mount] = struct{}{}
		volumes = append(volumes, DiskVolumeInfo{
			MountPoint:    mount,
			Label:         lookupVolumeLabel(mount),
			Total_GB:      bytesToRoundedGB(usage.Total),
			Used_GB:       bytesToRoundedGB(usage.Used),
			EncryptStatus: fallbackEncryptStatus(encryptionByDrive[mount]),
		})
	}

	sort.Slice(volumes, func(i, j int) bool {
		return volumes[i].MountPoint < volumes[j].MountPoint
	})

	return volumes
}

func summarizeDiskEncryption(volumes []DiskVolumeInfo) (primary DiskVolumeInfo, encryptionStatus string, diskEncrypted bool) {
	if len(volumes) == 0 {
		return DiskVolumeInfo{}, "unknown", false
	}

	primary = volumes[0]
	for _, volume := range volumes {
		if volume.MountPoint == "C:" {
			primary = volume
			break
		}
	}

	onCount := 0
	offCount := 0
	unknownCount := 0
	for _, volume := range volumes {
		switch volume.EncryptStatus {
		case "on":
			onCount++
		case "off":
			offCount++
		default:
			unknownCount++
		}
	}

	switch {
	case onCount > 0 && offCount == 0 && unknownCount == 0:
		return primary, "all", true
	case onCount > 0 && (offCount > 0 || unknownCount > 0):
		return primary, "partial", false
	case offCount > 0 && onCount == 0:
		return primary, "none", false
	default:
		return primary, "unknown", false
	}
}

func collectEncryptionByDriveLetter() map[string]string {
	statuses := queryEncryptionViaWMI()
	if statuses == nil {
		statuses = make(map[string]string)
	}
	for _, drive := range listFixedDriveLetters() {
		if statuses[drive] != "" && statuses[drive] != "unknown" {
			continue
		}
		if cliStatus := queryManageBDEStatus(drive); cliStatus != "unknown" {
			statuses[drive] = cliStatus
		} else if statuses[drive] == "" {
			statuses[drive] = "unknown"
		}
	}
	return statuses
}

func queryEncryptionViaWMI() map[string]string {
	var volumes []win32EncryptableVolumeFull
	err := wmi.Query(
		"SELECT DriveLetter, ProtectionStatus, ConversionStatus FROM Win32_EncryptableVolume WHERE DriveLetter IS NOT NULL",
		&volumes,
		"root\\CIMV2\\Security\\MicrosoftVolumeEncryption",
	)
	if err != nil {
		return nil
	}

	statuses := make(map[string]string, len(volumes))
	for _, volume := range volumes {
		drive := normalizeDriveLetter(volume.DriveLetter)
		if drive == "" {
			continue
		}
		statuses[drive] = mapProtectionStatus(volume.ProtectionStatus, volume.ConversionStatus)
	}
	return statuses
}

func mapProtectionStatus(protectionStatus, conversionStatus uint32) string {
	switch protectionStatus {
	case 1:
		return "on"
	case 0:
		if conversionStatus == 1 {
			return "on"
		}
		return "off"
	default:
		return "unknown"
	}
}


func queryManageBDEStatus(drive string) string {
	letter := strings.TrimSuffix(drive, ":")
	cmd := exec.Command("manage-bde.exe", "-status", letter+":")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "unknown"
	}

	text := strings.ToLower(string(output))
	switch {
	case strings.Contains(text, "protection on"):
		return "on"
	case strings.Contains(text, "fully decrypted"):
		return "off"
	case strings.Contains(text, "encryption in progress"), strings.Contains(text, "decryption in progress"):
		return "on"
	default:
		return "unknown"
	}
}

func listFixedDriveLetters() []string {
	var disks []win32LogicalDisk
	if err := wmi.Query("SELECT DeviceID, DriveType FROM Win32_LogicalDisk", &disks); err != nil {
		return nil
	}

	letters := make([]string, 0, len(disks))
	for _, entry := range disks {
		if entry.DriveType != 3 {
			continue
		}
		if drive := normalizeDriveLetter(entry.DeviceID); drive != "" {
			letters = append(letters, drive)
		}
	}
	sort.Strings(letters)
	return letters
}

func lookupVolumeLabel(drive string) string {
	var disks []win32LogicalDisk
	if err := wmi.Query("SELECT DeviceID, VolumeName FROM Win32_LogicalDisk", &disks); err != nil {
		return ""
	}
	for _, entry := range disks {
		if normalizeDriveLetter(entry.DeviceID) == drive {
			return strings.TrimSpace(entry.VolumeName)
		}
	}
	return ""
}

func isFixedDataVolume(drive string) bool {
	var disks []win32LogicalDisk
	if err := wmi.Query("SELECT DeviceID, DriveType FROM Win32_LogicalDisk", &disks); err != nil {
		return strings.HasSuffix(drive, ":")
	}
	for _, entry := range disks {
		if normalizeDriveLetter(entry.DeviceID) != drive {
			continue
		}
		return entry.DriveType == 3
	}
	return false
}

func normalizeDriveLetter(mountpoint string) string {
	mountpoint = strings.TrimSpace(mountpoint)
	if len(mountpoint) < 2 {
		return ""
	}
	letter := strings.ToUpper(mountpoint[:1])
	if letter < "A" || letter > "Z" {
		return ""
	}
	return letter + ":"
}

func fallbackEncryptStatus(status string) string {
	if status == "" {
		return "unknown"
	}
	return status
}
