package models

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
