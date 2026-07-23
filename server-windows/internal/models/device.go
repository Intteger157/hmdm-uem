package models

import (
	"encoding/json"
	"time"
)

// EnrollRequest is sent by the Windows agent during token-based enrollment.
type EnrollRequest struct {
	EnrollmentToken string `json:"enrollment_token" binding:"required"`
	HardwareID      string `json:"hardware_id" binding:"required"`
}

// EnrollResponse contains the JWT issued after successful enrollment.
type EnrollResponse struct {
	AuthToken string `json:"auth_token"`
}

// InventoryRequest mirrors the inventory payload sent by the Windows agent.
type InventoryRequest struct {
	Hostname          string               `json:"hostname"`
	OSVersion         string               `json:"os_version"`
	CPU                          string                    `json:"cpu"`
	CPUCores                     int                       `json:"cpu_cores,omitempty"`
	CPUThreads                   int                       `json:"cpu_threads,omitempty"`
	CPUFrequencyGHz              float64                   `json:"cpu_frequency_ghz,omitempty"`
	RAM_GB                       int                       `json:"ram_gb"`
	DiskTotal_GB      int                  `json:"disk_total_gb"`
	DiskUsed_GB       int                  `json:"disk_used_gb"`
	Manufacturer      string               `json:"manufacturer"`
	Model             string               `json:"model"`
	SerialNumber      string               `json:"serial_number"`
	CurrentUser       string                `json:"current_user"`
	DiskEncrypted     bool                  `json:"disk_encrypted"`
	EncryptionStatus  string                `json:"encryption_status"`
	Disks             []InventoryDiskVolume `json:"disks"`
	LocalUsers        []InventoryLocalUser  `json:"local_users"`
	InstalledSoftware []InventorySoftware  `json:"installed_software"`
	UptimeSeconds     int64                `json:"uptime_seconds"`
	AntivirusName                string               `json:"antivirus_name"`
	AntivirusActive              bool                 `json:"antivirus_active"`
	AntivirusDefinitionsUpdated  string               `json:"antivirus_definitions_updated"`
	Latitude          float64              `json:"latitude"`
	Longitude         float64              `json:"longitude"`
	LocalIP           string               `json:"local_ip"`
	PublicIP          string               `json:"public_ip"`
	WifiBSSID         string               `json:"wifi_bssid"`
	PendingUpdates               int                        `json:"pending_updates"`
	LastUpdateCheck              string                     `json:"last_update_check"`
	PendingUpdatesList           []InventoryWindowsUpdate   `json:"pending_updates_list"`
	InstalledUpdatesList         []InventoryWindowsUpdate   `json:"installed_updates_list"`
	BitLockerKey                 string                     `json:"bitlocker_key"`
}

// WindowsDevice is the persisted Windows agent record in PostgreSQL.
type WindowsDevice struct {
	ID                uint      `gorm:"primaryKey"`
	HardwareID        string    `gorm:"uniqueIndex"`
	EnrollmentToken   string
	Hostname          string
	OSVersion         string
	CPU                          string
	CPUCores                     int `gorm:"column:cpu_cores"`
	CPUThreads                   int `gorm:"column:cpu_threads"`
	CPUFrequencyGHz              float64 `gorm:"column:cpu_frequency_ghz"`
	RAM_GB                       int
	DiskTotal_GB      int
	DiskUsed_GB       int
	Manufacturer      string
	Model             string
	SerialNumber      string
	CurrentUser       string
	DiskEncrypted     bool
	EncryptionStatus  string
	Disks             json.RawMessage `gorm:"type:jsonb"`
	LocalUsers        json.RawMessage `gorm:"type:jsonb"`
	InstalledSoftware json.RawMessage `gorm:"type:jsonb"`
	Services          json.RawMessage `gorm:"type:jsonb"`
	UptimeSeconds     int64
	AntivirusName                string
	AntivirusActive              bool
	AntivirusDefinitionsUpdated  string
	Latitude          float64
	Longitude         float64
	LocalIP           string
	PublicIP          string
	WifiBSSID         string
	PendingUpdates               int
	LastUpdateCheck              string
	PendingUpdatesList           json.RawMessage `gorm:"type:jsonb"`
	InstalledUpdatesList         json.RawMessage `gorm:"type:jsonb"`
	BitLockerKey                 string
	ServicesUpdatedAt *time.Time
	LastCheckin       time.Time
	AgentStatus       string     `gorm:"not null;default:active"`
	UninstalledAt     *time.Time
	GroupID           *uint      `gorm:"index"`
}

const (
	AgentStatusActive      = "active"
	AgentStatusUninstalled = "uninstalled"
)

// TableName pins Windows inventory to a dedicated table, isolated from Java MDM `devices`.
func (WindowsDevice) TableName() string {
	return "windows_devices"
}

// WindowsDeviceJSON is the admin UI list payload for a single Windows agent.
type WindowsDeviceJSON struct {
	ID                uint                      `json:"id"`
	HardwareID        string                    `json:"hardwareId"`
	Hostname          string                    `json:"hostname"`
	OSVersion         string                    `json:"osVersion"`
	CPU                          string                    `json:"cpu"`
	CPUCores                     int                       `json:"cpuCores,omitempty"`
	CPUThreads                   int                       `json:"cpuThreads,omitempty"`
	CPUFrequencyGHz              float64                   `json:"cpuFrequencyGhz,omitempty"`
	RAM_GB                       int                       `json:"ramGb"`
	DiskTotal_GB      int                       `json:"diskTotalGb"`
	DiskUsed_GB       int                       `json:"diskUsedGb"`
	Manufacturer      string                    `json:"manufacturer,omitempty"`
	Model             string                    `json:"model,omitempty"`
	SerialNumber      string                    `json:"serialNumber,omitempty"`
	CurrentUser       string                    `json:"currentUser,omitempty"`
	DiskEncrypted     bool                      `json:"diskEncrypted"`
	EncryptionStatus  string                    `json:"encryptionStatus,omitempty"`
	Disks             []DiskVolumeRecord        `json:"disks,omitempty"`
	LocalUsers        []LocalUserRecord         `json:"localUsers,omitempty"`
	InstalledSoftware []InstalledSoftwareRecord `json:"installedSoftware,omitempty"`
	UptimeSeconds     int64                     `json:"uptimeSeconds,omitempty"`
	AntivirusName                string                    `json:"antivirusName,omitempty"`
	AntivirusActive              bool                      `json:"antivirusActive"`
	AntivirusDefinitionsUpdated  string                    `json:"antivirusDefinitionsUpdated,omitempty"`
	Latitude          float64                   `json:"latitude,omitempty"`
	Longitude         float64                   `json:"longitude,omitempty"`
	LocalIP           string                    `json:"localIp,omitempty"`
	PublicIP          string                    `json:"publicIp,omitempty"`
	WifiBSSID         string                    `json:"wifiBssid,omitempty"`
	PendingUpdates               int                       `json:"pendingUpdates,omitempty"`
	LastUpdateCheck              string                    `json:"lastUpdateCheck,omitempty"`
	PendingUpdatesList           []WindowsUpdateRecord     `json:"pendingUpdatesList,omitempty"`
	InstalledUpdatesList         []WindowsUpdateRecord     `json:"installedUpdatesList,omitempty"`
	BitLockerKey                 string                    `json:"bitLockerKey,omitempty"`
	ServicesUpdatedAt *time.Time                `json:"servicesUpdatedAt,omitempty"`
	LastCheckin       time.Time                 `json:"lastCheckin"`
	AgentStatus       string                    `json:"agentStatus"`
	UninstalledAt     *time.Time                `json:"uninstalledAt,omitempty"`
	GroupID           *uint                     `json:"groupId,omitempty"`
	GroupName         string                    `json:"groupName,omitempty"`
}

// WindowsDeviceListResponse is returned by GET /rest/windows/devices.
type WindowsDeviceListResponse struct {
	Items           []WindowsDeviceJSON `json:"items"`
	TotalItemsCount int64               `json:"totalItemsCount"`
}

func ToWindowsDeviceJSON(device WindowsDevice) WindowsDeviceJSON {
	return WindowsDeviceJSON{
		ID:                device.ID,
		HardwareID:        device.HardwareID,
		Hostname:          device.Hostname,
		OSVersion:         device.OSVersion,
		CPU:                          device.CPU,
		CPUCores:                     device.CPUCores,
		CPUThreads:                   device.CPUThreads,
		CPUFrequencyGHz:              device.CPUFrequencyGHz,
		RAM_GB:                       device.RAM_GB,
		DiskTotal_GB:      device.DiskTotal_GB,
		DiskUsed_GB:       device.DiskUsed_GB,
		Manufacturer:      device.Manufacturer,
		Model:             device.Model,
		SerialNumber:      device.SerialNumber,
		CurrentUser:       device.CurrentUser,
		DiskEncrypted:     device.DiskEncrypted,
		EncryptionStatus:  device.EncryptionStatus,
		Disks:             decodeDisks(device.Disks),
		LocalUsers:        decodeLocalUsers(device.LocalUsers),
		InstalledSoftware: decodeInstalledSoftware(device.InstalledSoftware),
		UptimeSeconds:     device.UptimeSeconds,
		AntivirusName:                device.AntivirusName,
		AntivirusActive:              device.AntivirusActive,
		AntivirusDefinitionsUpdated:  device.AntivirusDefinitionsUpdated,
		Latitude:          device.Latitude,
		Longitude:         device.Longitude,
		LocalIP:           device.LocalIP,
		PublicIP:          device.PublicIP,
		WifiBSSID:         device.WifiBSSID,
		PendingUpdates:               device.PendingUpdates,
		LastUpdateCheck:              device.LastUpdateCheck,
		PendingUpdatesList:           decodeWindowsUpdates(device.PendingUpdatesList),
		InstalledUpdatesList:         decodeWindowsUpdates(device.InstalledUpdatesList),
		BitLockerKey:                 device.BitLockerKey,
		ServicesUpdatedAt: device.ServicesUpdatedAt,
		LastCheckin:       device.LastCheckin,
		AgentStatus:       normalizeAgentStatus(device.AgentStatus),
		UninstalledAt:     device.UninstalledAt,
		GroupID:           device.GroupID,
	}
}

func normalizeAgentStatus(raw string) string {
	if raw == AgentStatusUninstalled {
		return AgentStatusUninstalled
	}
	return AgentStatusActive
}

func decodeWindowsUpdates(raw json.RawMessage) []WindowsUpdateRecord {
	if len(raw) == 0 {
		return nil
	}
	var updates []WindowsUpdateRecord
	if err := json.Unmarshal(raw, &updates); err != nil {
		return nil
	}
	return updates
}

func EncodeWindowsUpdates(updates []InventoryWindowsUpdate) (json.RawMessage, error) {
	if len(updates) == 0 {
		return nil, nil
	}

	records := make([]WindowsUpdateRecord, 0, len(updates))
	for _, update := range updates {
		records = append(records, WindowsUpdateRecord{
			Title:       update.Title,
			KB:          update.KB,
			InstalledOn: update.InstalledOn,
		})
	}

	encoded, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func decodeDisks(raw json.RawMessage) []DiskVolumeRecord {
	if len(raw) == 0 {
		return nil
	}
	var disks []DiskVolumeRecord
	if err := json.Unmarshal(raw, &disks); err != nil {
		return nil
	}
	return disks
}

func EncodeDisks(disks []InventoryDiskVolume) (json.RawMessage, error) {
	if len(disks) == 0 {
		return nil, nil
	}

	records := make([]DiskVolumeRecord, 0, len(disks))
	for _, disk := range disks {
		records = append(records, DiskVolumeRecord{
			MountPoint:    disk.MountPoint,
			Label:         disk.Label,
			TotalGb:       disk.Total_GB,
			UsedGb:        disk.Used_GB,
			EncryptStatus: disk.EncryptStatus,
		})
	}

	encoded, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func decodeLocalUsers(raw json.RawMessage) []LocalUserRecord {
	if len(raw) == 0 {
		return nil
	}
	var users []LocalUserRecord
	if err := json.Unmarshal(raw, &users); err != nil {
		return nil
	}
	return users
}

func decodeInstalledSoftware(raw json.RawMessage) []InstalledSoftwareRecord {
	if len(raw) == 0 {
		return nil
	}
	var software []InstalledSoftwareRecord
	if err := json.Unmarshal(raw, &software); err != nil {
		return nil
	}
	return software
}

func EncodeLocalUsers(users []InventoryLocalUser) (json.RawMessage, error) {
	if len(users) == 0 {
		return nil, nil
	}

	records := make([]LocalUserRecord, 0, len(users))
	for _, user := range users {
		records = append(records, LocalUserRecord{
			Username: user.Username,
			IsAdmin:  user.IsAdmin,
			Status:   user.Status,
		})
	}

	encoded, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

func EncodeInstalledSoftware(software []InventorySoftware) (json.RawMessage, error) {
	if len(software) == 0 {
		return nil, nil
	}

	records := make([]InstalledSoftwareRecord, 0, len(software))
	for _, app := range software {
		records = append(records, InstalledSoftwareRecord{
			Name:        app.Name,
			Version:     app.Version,
			Publisher:   app.Publisher,
			InstallDate: app.InstallDate,
		})
	}

	encoded, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}

// DecodeServices exposes cached service records for handlers.
func DecodeServices(raw json.RawMessage) []ServiceRecord {
	return decodeServices(raw)
}

func decodeServices(raw json.RawMessage) []ServiceRecord {
	if len(raw) == 0 {
		return nil
	}
	var services []ServiceRecord
	if err := json.Unmarshal(raw, &services); err != nil {
		return nil
	}
	return services
}

func EncodeServicesFromAgent(services []InventoryService) (json.RawMessage, error) {
	if len(services) == 0 {
		return nil, nil
	}

	records := make([]ServiceRecord, 0, len(services))
	for _, service := range services {
		records = append(records, ServiceRecord{
			Name:        service.Name,
			DisplayName: service.DisplayName,
			Status:      service.Status,
		})
	}

	encoded, err := json.Marshal(records)
	if err != nil {
		return nil, err
	}
	return encoded, nil
}
