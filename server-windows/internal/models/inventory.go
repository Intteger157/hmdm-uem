package models

import "time"

// InventoryDiskVolume mirrors one Windows drive in inventory payload.
type InventoryDiskVolume struct {
	MountPoint    string `json:"mount_point"`
	Label         string `json:"label"`
	Total_GB      int    `json:"total_gb"`
	Used_GB       int    `json:"used_gb"`
	EncryptStatus string `json:"encrypt_status"`
}

// DiskVolumeRecord is stored in windows_devices.disks JSONB.
type DiskVolumeRecord struct {
	MountPoint    string `json:"mountPoint"`
	Label         string `json:"label,omitempty"`
	TotalGb       int    `json:"totalGb"`
	UsedGb        int    `json:"usedGb"`
	EncryptStatus string `json:"encryptStatus"`
}

type LocalUserRecord struct {
	Username string `json:"username"`
	IsAdmin  bool   `json:"isAdmin"`
	Status   string `json:"status"`
}

// InstalledSoftwareRecord is stored in windows_devices.installed_software JSONB.
type InstalledSoftwareRecord struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Publisher   string `json:"publisher"`
	InstallDate string `json:"installDate"`
}

// InventoryLocalUser mirrors the Windows agent inventory payload.
type InventoryLocalUser struct {
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
	Status   string `json:"status"`
}

// InventorySoftware mirrors the Windows agent inventory payload.
type InventorySoftware struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Publisher   string `json:"publisher"`
	InstallDate string `json:"install_date"`
}

// InventoryService mirrors one Windows service in agent payload.
type InventoryService struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}

// ServiceRecord is stored in windows_devices.services JSONB.
type ServiceRecord struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	Status      string `json:"status"`
}

// InventoryWindowsUpdate mirrors one Windows update in agent inventory payload.
type InventoryWindowsUpdate struct {
	Title       string `json:"title"`
	KB          string `json:"kb,omitempty"`
	InstalledOn string `json:"installed_on,omitempty"`
}

// WindowsUpdateRecord is stored in windows_devices pending/installed updates JSONB.
type WindowsUpdateRecord struct {
	Title       string `json:"title"`
	KB          string `json:"kb,omitempty"`
	InstalledOn string `json:"installedOn,omitempty"`
}

// DeviceServicesResponse is returned by GET /rest/windows/devices/:hardwareId/services.
type DeviceServicesResponse struct {
	Items     []ServiceRecord `json:"items"`
	UpdatedAt *time.Time      `json:"updatedAt,omitempty"`
}
