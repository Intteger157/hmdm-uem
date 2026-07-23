package models

// ProfileApp links a config profile to a required software app.
type ProfileApp struct {
	ProfileID uint `gorm:"primaryKey"`
	AppID     uint `gorm:"primaryKey;index"`
}

func (ProfileApp) TableName() string {
	return "profile_apps"
}

// AssignProfileAppsRequest replaces required apps for a profile.
type AssignProfileAppsRequest struct {
	AppIDs []uint `json:"appIds"`
}

// ProfileAppsResponse lists required apps for a profile.
type ProfileAppsResponse struct {
	AppIDs []uint `json:"appIds"`
}
