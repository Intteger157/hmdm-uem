//go:build windows

package system

import (
	"fmt"
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
		totalGB := 0
		usedGB := 0
		if err == nil && usage.Total > 0 {
			totalGB = bytesToRoundedGB(usage.Total)
			usedGB = bytesToRoundedGB(usage.Used)
		} else if encryptStatus := encryptionByDrive[mount]; encryptStatus != "on" {
			continue
		}

		seen[mount] = struct{}{}
		volumes = append(volumes, DiskVolumeInfo{
			MountPoint:    mount,
			Label:         lookupVolumeLabel(mount),
			Total_GB:      totalGB,
			Used_GB:       usedGB,
			EncryptStatus: fallbackEncryptStatus(encryptionByDrive[mount]),
		})
	}

	for drive, encryptStatus := range encryptionByDrive {
		if _, exists := seen[drive]; exists {
			continue
		}
		if !isFixedDataVolume(drive) {
			continue
		}
		seen[drive] = struct{}{}
		volumes = append(volumes, DiskVolumeInfo{
			MountPoint:    drive,
			Label:         lookupVolumeLabel(drive),
			EncryptStatus: fallbackEncryptStatus(encryptStatus),
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
	statuses := queryAllManageBDEStatuses()
	if statuses == nil {
		statuses = make(map[string]string)
	}

	if wmiStatuses := queryEncryptionViaWMI(); wmiStatuses != nil {
		for drive, status := range wmiStatuses {
			if statuses[drive] == "" || statuses[drive] == "unknown" {
				statuses[drive] = status
			}
		}
	}

	for _, drive := range listFixedDriveLetters() {
		if statuses[drive] != "" && statuses[drive] != "unknown" {
			continue
		}
		if cliStatus := queryManageBDEStatus(drive); cliStatus != "unknown" {
			statuses[drive] = cliStatus
			continue
		}
		if psStatus := queryEncryptionViaPowerShell(drive); psStatus != "unknown" {
			statuses[drive] = psStatus
			continue
		}
		if blStatus := queryEncryptionViaBitLockerModule(drive); blStatus != "unknown" {
			statuses[drive] = blStatus
			continue
		}
		if statuses[drive] == "" {
			statuses[drive] = "unknown"
		}
	}
	return statuses
}

func queryAllManageBDEStatuses() map[string]string {
	cmd := exec.Command("manage-bde.exe", "-status")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	text := string(output)
	if err != nil && !strings.Contains(strings.ToLower(text), "volume") {
		return nil
	}
	return parseManageBDEStatusOutput(text)
}

func parseManageBDEStatusOutput(text string) map[string]string {
	statuses := make(map[string]string)
	lines := strings.Split(text, "\n")
	var currentDrive string

	for _, rawLine := range lines {
		line := strings.TrimSpace(rawLine)
		lower := strings.ToLower(line)

		if drive := parseManageBDEVolumeHeader(line); drive != "" {
			currentDrive = drive
			continue
		}

		if currentDrive == "" {
			continue
		}

		switch {
		case strings.Contains(lower, "protection on"),
			strings.Contains(lower, "fully encrypted"),
			strings.Contains(lower, "encryption in progress"),
			strings.Contains(lower, "decryption in progress"),
			strings.Contains(lower, "lock status:") && strings.Contains(lower, "locked"),
			strings.Contains(lower, "bitlocker on"):
			statuses[currentDrive] = "on"
		case strings.Contains(lower, "protection off"),
			strings.Contains(lower, "fully decrypted"),
			strings.Contains(lower, "not protected"),
			strings.Contains(lower, "bitlocker off"),
			strings.Contains(lower, "encryption method:") && strings.Contains(lower, "none"),
			strings.Contains(lower, "bitlocker version:") && strings.Contains(lower, "none"):
			statuses[currentDrive] = "off"
		}
	}

	return statuses
}

func parseManageBDEVolumeHeader(line string) string {
	lower := strings.ToLower(strings.TrimSpace(line))
	if !strings.HasPrefix(lower, "volume ") {
		return ""
	}

	rest := strings.TrimSpace(strings.TrimPrefix(lower, "volume "))
	if len(rest) >= 2 && rest[1] == ':' {
		return normalizeDriveLetter(strings.ToUpper(rest[:1]) + ":")
	}
	return ""
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
		if conversionStatus == 1 || conversionStatus == 2 || conversionStatus == 3 || conversionStatus == 4 {
			return "on"
		}
		return "off"
	case 2:
		if conversionStatus == 1 || conversionStatus == 2 || conversionStatus == 3 || conversionStatus == 4 {
			return "on"
		}
		if conversionStatus == 0 {
			return "off"
		}
		return "unknown"
	default:
		return "unknown"
	}
}


func queryManageBDEStatus(drive string) string {
	letter := strings.TrimSuffix(drive, ":")
	cmd := exec.Command("manage-bde.exe", "-status", letter+":")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	text := strings.ToLower(string(output))

	switch {
	case strings.Contains(text, "protection on"),
		strings.Contains(text, "fully encrypted"),
		strings.Contains(text, "encryption in progress"),
		strings.Contains(text, "decryption in progress"),
		strings.Contains(text, "lock status:") && strings.Contains(text, "locked"),
		strings.Contains(text, "bitlocker on"):
		return "on"
	case strings.Contains(text, "protection off"),
		strings.Contains(text, "fully decrypted"),
		strings.Contains(text, "not protected"),
		strings.Contains(text, "bitlocker off"),
		strings.Contains(text, "bitlocker version:    none"),
		strings.Contains(text, "encryption method:    none"),
		strings.Contains(text, "percentage encrypted: 0.0%"):
		return "off"
	default:
		if err != nil {
			return "unknown"
		}
		return "unknown"
	}
}

func queryEncryptionViaPowerShell(drive string) string {
	letter := strings.TrimSuffix(drive, ":") + ":"
	script := fmt.Sprintf(
		"$v = Get-CimInstance -Namespace 'root/CIMV2/Security/MicrosoftVolumeEncryption' -ClassName Win32_EncryptableVolume -Filter \"DriveLetter='%s'\" -ErrorAction SilentlyContinue | Select-Object -First 1; if ($null -eq $v) { exit 2 }; switch ($v.ProtectionStatus) { 1 { 'on' } 0 { if ($v.ConversionStatus -eq 1 -or $v.ConversionStatus -eq 2 -or $v.ConversionStatus -eq 3) { 'on' } else { 'off' } } default { 'unknown' } }",
		letter,
	)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	status := strings.TrimSpace(string(output))
	if err != nil || status == "" {
		return "unknown"
	}
	switch status {
	case "on", "off":
		return status
	default:
		return "unknown"
	}
}

func queryEncryptionViaBitLockerModule(drive string) string {
	script := fmt.Sprintf(
		"$ErrorActionPreference='SilentlyContinue'; Import-Module BitLocker; $v = Get-BitLockerVolume -MountPoint '%s' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($null -eq $v) { exit 2 }; if ($v.LockStatus -eq 'Locked') { 'on'; exit 0 }; switch ($v.VolumeStatus.ToString()) { 'FullyEncrypted' { 'on' } 'EncryptionInProgress' { 'on' } 'DecryptionInProgress' { 'on' } 'FullyDecrypted' { 'off' } default { 'unknown' } }",
		drive,
	)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	status := strings.TrimSpace(string(output))
	if err != nil || status == "" {
		return "unknown"
	}
	switch status {
	case "on", "off":
		return status
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
