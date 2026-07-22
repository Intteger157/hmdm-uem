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
	CPU               string               `json:"cpu"`
	RAM_GB            int                  `json:"ram_gb"`
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
}

// WindowsDevice is the persisted Windows agent record in PostgreSQL.
type WindowsDevice struct {
	ID                uint      `gorm:"primaryKey"`
	HardwareID        string    `gorm:"uniqueIndex"`
	EnrollmentToken   string
	Hostname          string
	OSVersion         string
	CPU               string
	RAM_GB            int
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
	LastCheckin       time.Time
}

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
	CPU               string                    `json:"cpu"`
	RAM_GB            int                       `json:"ramGb"`
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
	LastCheckin       time.Time                 `json:"lastCheckin"`
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
		CPU:               device.CPU,
		RAM_GB:            device.RAM_GB,
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
		LastCheckin:       device.LastCheckin,
	}
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
