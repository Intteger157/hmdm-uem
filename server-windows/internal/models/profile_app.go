package models

// ProfileApp links a config profile to a required application.
type ProfileApp struct {
	ProfileID uint  `gorm:"primaryKey"`
	AppID     uint  `gorm:"primaryKey;index"`
	VersionID *uint `gorm:"index"` // nil = latest active version
}

func (ProfileApp) TableName() string {
	return "profile_apps"
}

// ProfileAppAssignment selects an app and optional pinned version.
type ProfileAppAssignment struct {
	AppID     uint  `json:"appId"`
	VersionID *uint `json:"versionId,omitempty"`
}

// AssignProfileAppsRequest replaces required apps for a profile.
type AssignProfileAppsRequest struct {
	AppIDs      []uint                 `json:"appIds"`
	Assignments []ProfileAppAssignment `json:"assignments"`
}

// ProfileAppsResponse lists required apps for a profile.
type ProfileAppsResponse struct {
	AppIDs      []uint                 `json:"appIds"`
	Assignments []ProfileAppAssignment `json:"assignments"`
}
