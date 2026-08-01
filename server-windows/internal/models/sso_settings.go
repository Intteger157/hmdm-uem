package models

import "time"

const (
	SSOProviderEntra = "entra"
)

// SSOSettings stores console-wide single sign-on configuration.
type SSOSettings struct {
	ID           uint      `gorm:"primaryKey"`
	Provider     string    `gorm:"column:provider;not null;default:entra"`
	Enabled      bool      `gorm:"column:enabled;not null;default:false"`
	TenantID     string    `gorm:"column:tenant_id;not null;default:''"`
	ClientID     string    `gorm:"column:client_id;not null;default:''"`
	ClientSecret string    `gorm:"column:client_secret;not null;default:''"`
	UpdatedAt    time.Time `gorm:"column:updated_at;not null"`
}

func (SSOSettings) TableName() string {
	return "sso_settings"
}

// SSOSettingsResponse is returned by GET /rest/sso/settings.
type SSOSettingsResponse struct {
	Provider     string `json:"provider"`
	Enabled      bool   `json:"enabled"`
	TenantID     string `json:"tenantId"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}

// UpdateSSOSettingsRequest updates console SSO configuration.
type UpdateSSOSettingsRequest struct {
	Provider     string `json:"provider"`
	Enabled      bool   `json:"enabled"`
	TenantID     string `json:"tenantId"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
}
