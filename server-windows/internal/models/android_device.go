package models

import (
	"encoding/json"
	"strings"
	"time"
)

// AndroidDevice maps the legacy Java `devices` table used by enrolled Android agents.
type AndroidDevice struct {
	ID              uint            `gorm:"primaryKey;column:id" json:"id"`
	Number          string          `gorm:"column:number" json:"number"`
	Description     *string         `gorm:"column:description" json:"description,omitempty"`
	LastUpdate      *int64          `gorm:"column:lastupdate" json:"lastUpdate,omitempty"`
	ConfigurationID *uint           `gorm:"column:configurationid" json:"configurationId,omitempty"`
	Info            *string         `gorm:"column:info" json:"-"`
	InfoJSON        json.RawMessage `gorm:"column:infojson" json:"-"`
	IMEI            *string         `gorm:"column:imei" json:"imei,omitempty"`
	Phone           *string         `gorm:"column:phone" json:"phone,omitempty"`
	CustomerID      int             `gorm:"column:customerid" json:"customerId"`
	EnrollTime      *int64          `gorm:"column:enrolltime" json:"enrollTime,omitempty"`
	PublicIP        *string         `gorm:"column:publicip" json:"publicIp,omitempty"`
	Custom1         *string         `gorm:"column:custom1" json:"custom1,omitempty"`
	Custom2         *string         `gorm:"column:custom2" json:"custom2,omitempty"`
	Custom3         *string         `gorm:"column:custom3" json:"custom3,omitempty"`
	OldNumber       *string         `gorm:"column:oldnumber" json:"oldNumber,omitempty"`
}

func (AndroidDevice) TableName() string {
	return "devices"
}

// AndroidDeviceInfoJSON mirrors the fields the console reads from devices.infojson.
type AndroidDeviceInfoJSON struct {
	Model          string `json:"model"`
	IMEI           string `json:"imei"`
	Phone          string `json:"phone"`
	AndroidVersion string `json:"androidVersion"`
	Serial         string `json:"serial"`
	MDMMode        *bool  `json:"mdmMode"`
	KioskMode      *bool  `json:"kioskMode"`
	BatteryLevel   *int   `json:"batteryLevel"`
	DefaultLauncher *bool `json:"defaultLauncher"`
}

func ParseAndroidDeviceInfo(raw json.RawMessage, legacy *string) AndroidDeviceInfoJSON {
	if len(raw) > 0 {
		var parsed AndroidDeviceInfoJSON
		if err := json.Unmarshal(raw, &parsed); err == nil {
			return parsed
		}
	}
	if legacy != nil && strings.TrimSpace(*legacy) != "" {
		var parsed AndroidDeviceInfoJSON
		if err := json.Unmarshal([]byte(*legacy), &parsed); err == nil {
			return parsed
		}
	}
	return AndroidDeviceInfoJSON{}
}

func AndroidOnlineStatus(lastUpdate *int64, now time.Time) string {
	if lastUpdate == nil || *lastUpdate <= 0 {
		return "grey"
	}
	ageMs := now.UnixMilli() - *lastUpdate
	switch {
	case ageMs < 20*60*1000:
		return "green"
	case ageMs < 2*3600*1000:
		return "yellow"
	default:
		return "red"
	}
}
