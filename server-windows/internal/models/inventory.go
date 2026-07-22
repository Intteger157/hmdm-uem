package models

// LocalUserRecord is stored in windows_devices.local_users JSONB.
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
