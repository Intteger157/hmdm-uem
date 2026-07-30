package models

import "strings"

// Platform scopes bind a console role to one device ecosystem.
const (
	PlatformScopeGlobal  = "global"
	PlatformScopeWindows = "windows"
	PlatformScopeAndroid = "android"
)

// Access levels rank what a role may do inside its platform scope.
const (
	AccessLevelHigh = "high"
	AccessLevelMid  = "mid"
	AccessLevelLow  = "low"
)

// UserRole maps the console role table created and owned by the legacy Java
// server (Liquibase `userRoles`, folded to lowercase by PostgreSQL). Go only
// manages the two RBAC matrix columns; name, description, superadmin and the
// permission join tables remain the Java side's responsibility.
type UserRole struct {
	ID            uint    `gorm:"primaryKey;column:id" json:"id"`
	Name          string  `gorm:"column:name;type:varchar(50);not null" json:"name"`
	Description   *string `gorm:"column:description;type:text" json:"description,omitempty"`
	SuperAdmin    bool    `gorm:"column:superadmin;not null;default:false" json:"superAdmin"`
	PlatformScope string  `gorm:"column:platform_scope;type:varchar(16);not null;default:'global'" json:"platformScope"`
	AccessLevel   string  `gorm:"column:access_level;type:varchar(16);not null;default:'high'" json:"accessLevel"`
}

// TableName pins the model to the Java-owned table instead of GORM's default
// pluralisation (`user_roles`), so both servers read the same rows.
func (UserRole) TableName() string {
	return "userroles"
}

// NormalizePlatformScope validates a caller-supplied scope, returning the
// canonical lowercase form and whether it is one of the known values.
func NormalizePlatformScope(raw string) (string, bool) {
	scope := strings.ToLower(strings.TrimSpace(raw))
	switch scope {
	case PlatformScopeGlobal, PlatformScopeWindows, PlatformScopeAndroid:
		return scope, true
	default:
		return "", false
	}
}

// NormalizeAccessLevel mirrors NormalizePlatformScope for the access dimension.
func NormalizeAccessLevel(raw string) (string, bool) {
	level := strings.ToLower(strings.TrimSpace(raw))
	switch level {
	case AccessLevelHigh, AccessLevelMid, AccessLevelLow:
		return level, true
	default:
		return "", false
	}
}

// EffectivePlatformScope falls back to "global" for rows written before the
// matrix columns existed. Those roles predate scoping and were unrestricted, so
// demoting them here would silently lock out working accounts.
func (r UserRole) EffectivePlatformScope() string {
	scope := strings.ToLower(strings.TrimSpace(r.PlatformScope))
	if scope == "" {
		return PlatformScopeGlobal
	}
	return scope
}

// EffectiveAccessLevel mirrors EffectivePlatformScope for the access dimension.
func (r UserRole) EffectiveAccessLevel() string {
	level := strings.ToLower(strings.TrimSpace(r.AccessLevel))
	if level == "" {
		return AccessLevelHigh
	}
	return level
}

// accessLevelRanks orders the levels so a route can demand a minimum. Higher
// wins; unknown levels are absent from the map and rank as -1 via AccessLevelRank.
var accessLevelRanks = map[string]int{
	AccessLevelLow:  0,
	AccessLevelMid:  1,
	AccessLevelHigh: 2,
}

// AccessLevelRank converts a level into a comparable rank, or -1 when the value
// is not a known level.
func AccessLevelRank(level string) int {
	rank, ok := accessLevelRanks[strings.ToLower(strings.TrimSpace(level))]
	if !ok {
		return -1
	}
	return rank
}

// AllowsPlatform reports whether the role may reach a route belonging to the
// given ecosystem. An empty platform means the route is ecosystem agnostic.
func (r UserRole) AllowsPlatform(platform string) bool {
	if platform == "" || r.SuperAdmin {
		return true
	}
	scope := r.EffectivePlatformScope()
	return scope == PlatformScopeGlobal || scope == platform
}

// AllowsAccessLevel reports whether the role meets a route's minimum level. An
// empty required level means the route places no demand on the access dimension.
func (r UserRole) AllowsAccessLevel(required string) bool {
	if required == "" || r.SuperAdmin {
		return true
	}
	return AccessLevelRank(r.EffectiveAccessLevel()) >= AccessLevelRank(required)
}

// VisibleScope is the scope the console UI must apply when hiding sections.
//
// It differs from EffectivePlatformScope for super admins: AllowsPlatform lets
// them through regardless of the stored scope, so reporting that scope verbatim
// would hide navigation they are in fact allowed to use.
func (r UserRole) VisibleScope() string {
	if r.SuperAdmin {
		return PlatformScopeGlobal
	}
	return r.EffectivePlatformScope()
}

// VisibleAccessLevel is the level the console UI must apply when hiding actions,
// standing in the same relation to AllowsAccessLevel as VisibleScope does to
// AllowsPlatform.
func (r UserRole) VisibleAccessLevel() string {
	if r.SuperAdmin {
		return AccessLevelHigh
	}
	return r.EffectiveAccessLevel()
}

// IsConsoleAdministrator reports whether the role may administer the console
// itself — users, roles and global settings — as opposed to the devices in one
// ecosystem.
//
// Editing a role rewrites the very columns this package authorises against, so
// anything less than an unrestricted operator would be able to widen its own
// scope and level.
func (r UserRole) IsConsoleAdministrator() bool {
	if r.SuperAdmin {
		return true
	}
	return r.EffectivePlatformScope() == PlatformScopeGlobal &&
		r.EffectiveAccessLevel() == AccessLevelHigh
}
