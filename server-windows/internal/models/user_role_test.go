package models

import "testing"

func TestUserRoleEffectiveDefaults(t *testing.T) {
	// Roles written before the matrix columns existed were unrestricted, so a
	// blank value must not silently demote them.
	role := UserRole{}

	if got := role.EffectivePlatformScope(); got != PlatformScopeGlobal {
		t.Errorf("EffectivePlatformScope() = %q, want %q", got, PlatformScopeGlobal)
	}
	if got := role.EffectiveAccessLevel(); got != AccessLevelHigh {
		t.Errorf("EffectiveAccessLevel() = %q, want %q", got, AccessLevelHigh)
	}
}

func TestUserRoleEffectiveNormalisesCasingAndSpace(t *testing.T) {
	role := UserRole{PlatformScope: "  Windows ", AccessLevel: " MID "}

	if got := role.EffectivePlatformScope(); got != PlatformScopeWindows {
		t.Errorf("EffectivePlatformScope() = %q, want %q", got, PlatformScopeWindows)
	}
	if got := role.EffectiveAccessLevel(); got != AccessLevelMid {
		t.Errorf("EffectiveAccessLevel() = %q, want %q", got, AccessLevelMid)
	}
}

func TestUserRoleAllowsPlatform(t *testing.T) {
	tests := []struct {
		name     string
		role     UserRole
		platform string
		want     bool
	}{
		{"global reaches windows", UserRole{PlatformScope: PlatformScopeGlobal}, PlatformScopeWindows, true},
		{"global reaches android", UserRole{PlatformScope: PlatformScopeGlobal}, PlatformScopeAndroid, true},
		{"windows reaches windows", UserRole{PlatformScope: PlatformScopeWindows}, PlatformScopeWindows, true},
		{"windows blocked from android", UserRole{PlatformScope: PlatformScopeWindows}, PlatformScopeAndroid, false},
		{"android blocked from windows", UserRole{PlatformScope: PlatformScopeAndroid}, PlatformScopeWindows, false},
		{"android reaches android", UserRole{PlatformScope: PlatformScopeAndroid}, PlatformScopeAndroid, true},
		{"agnostic route always allowed", UserRole{PlatformScope: PlatformScopeAndroid}, "", true},
		{"superadmin bypasses scope", UserRole{PlatformScope: PlatformScopeAndroid, SuperAdmin: true}, PlatformScopeWindows, true},
		{"unclassified role stays unrestricted", UserRole{}, PlatformScopeWindows, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.AllowsPlatform(tt.platform); got != tt.want {
				t.Errorf("AllowsPlatform(%q) = %v, want %v", tt.platform, got, tt.want)
			}
		})
	}
}

func TestUserRoleVisibleScope(t *testing.T) {
	tests := []struct {
		name string
		role UserRole
		want string
	}{
		{"global stays global", UserRole{PlatformScope: PlatformScopeGlobal}, PlatformScopeGlobal},
		{"windows stays windows", UserRole{PlatformScope: PlatformScopeWindows}, PlatformScopeWindows},
		{"android stays android", UserRole{PlatformScope: PlatformScopeAndroid}, PlatformScopeAndroid},
		{"blank scope reads as global", UserRole{}, PlatformScopeGlobal},
		// AllowsPlatform lets super admins through every platform check, so the
		// UI must not hide sections based on their stored scope.
		{"superadmin widens to global", UserRole{PlatformScope: PlatformScopeAndroid, SuperAdmin: true}, PlatformScopeGlobal},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.VisibleScope(); got != tt.want {
				t.Errorf("VisibleScope() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestUserRoleVisibleScopeAgreesWithAllowsPlatform(t *testing.T) {
	// The console hides navigation from VisibleScope while the server enforces
	// AllowsPlatform. If the two ever disagree the UI shows a section that 403s.
	roles := []UserRole{
		{PlatformScope: PlatformScopeGlobal},
		{PlatformScope: PlatformScopeWindows},
		{PlatformScope: PlatformScopeAndroid},
		{},
		{PlatformScope: PlatformScopeAndroid, SuperAdmin: true},
		{PlatformScope: PlatformScopeWindows, SuperAdmin: true},
	}

	for _, role := range roles {
		for _, platform := range []string{PlatformScopeWindows, PlatformScopeAndroid} {
			scope := role.VisibleScope()
			uiAllows := scope == PlatformScopeGlobal || scope == platform

			if uiAllows != role.AllowsPlatform(platform) {
				t.Errorf("role %+v platform %q: UI allows %v but server allows %v",
					role, platform, uiAllows, role.AllowsPlatform(platform))
			}
		}
	}
}

func TestAccessLevelRankOrdersTheMatrix(t *testing.T) {
	if AccessLevelRank(AccessLevelLow) >= AccessLevelRank(AccessLevelMid) {
		t.Error("low must rank below mid")
	}
	if AccessLevelRank(AccessLevelMid) >= AccessLevelRank(AccessLevelHigh) {
		t.Error("mid must rank below high")
	}
	if got := AccessLevelRank(" HIGH "); got != AccessLevelRank(AccessLevelHigh) {
		t.Errorf("AccessLevelRank(%q) = %d, want %d", " HIGH ", got, AccessLevelRank(AccessLevelHigh))
	}
	// An unknown level must not accidentally outrank a real one.
	if got := AccessLevelRank("root"); got != -1 {
		t.Errorf("AccessLevelRank(%q) = %d, want -1", "root", got)
	}
}

func TestUserRoleAllowsAccessLevel(t *testing.T) {
	tests := []struct {
		name     string
		role     UserRole
		required string
		want     bool
	}{
		{"high meets high", UserRole{AccessLevel: AccessLevelHigh}, AccessLevelHigh, true},
		{"high meets mid", UserRole{AccessLevel: AccessLevelHigh}, AccessLevelMid, true},
		{"mid meets mid", UserRole{AccessLevel: AccessLevelMid}, AccessLevelMid, true},
		{"mid blocked from high", UserRole{AccessLevel: AccessLevelMid}, AccessLevelHigh, false},
		{"low meets low", UserRole{AccessLevel: AccessLevelLow}, AccessLevelLow, true},
		{"low blocked from mid", UserRole{AccessLevel: AccessLevelLow}, AccessLevelMid, false},
		{"low blocked from high", UserRole{AccessLevel: AccessLevelLow}, AccessLevelHigh, false},
		{"unrequired level always allowed", UserRole{AccessLevel: AccessLevelLow}, "", true},
		{"superadmin bypasses level", UserRole{AccessLevel: AccessLevelLow, SuperAdmin: true}, AccessLevelHigh, true},
		{"unclassified role stays unrestricted", UserRole{}, AccessLevelHigh, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.AllowsAccessLevel(tt.required); got != tt.want {
				t.Errorf("AllowsAccessLevel(%q) = %v, want %v", tt.required, got, tt.want)
			}
		})
	}
}

func TestUserRoleVisibleAccessLevelAgreesWithAllowsAccessLevel(t *testing.T) {
	// The console hides actions from VisibleAccessLevel while the server enforces
	// AllowsAccessLevel. If the two disagree the UI offers a button that 403s.
	roles := []UserRole{
		{AccessLevel: AccessLevelHigh},
		{AccessLevel: AccessLevelMid},
		{AccessLevel: AccessLevelLow},
		{},
		{AccessLevel: AccessLevelLow, SuperAdmin: true},
	}

	for _, role := range roles {
		for _, required := range []string{AccessLevelLow, AccessLevelMid, AccessLevelHigh} {
			uiAllows := AccessLevelRank(role.VisibleAccessLevel()) >= AccessLevelRank(required)

			if uiAllows != role.AllowsAccessLevel(required) {
				t.Errorf("role %+v required %q: UI allows %v but server allows %v",
					role, required, uiAllows, role.AllowsAccessLevel(required))
			}
		}
	}
}

func TestUserRoleIsConsoleAdministrator(t *testing.T) {
	tests := []struct {
		name string
		role UserRole
		want bool
	}{
		{"global high administers", UserRole{PlatformScope: PlatformScopeGlobal, AccessLevel: AccessLevelHigh}, true},
		{"legacy blank role administers", UserRole{}, true},
		{"superadmin administers whatever its columns say",
			UserRole{PlatformScope: PlatformScopeWindows, AccessLevel: AccessLevelLow, SuperAdmin: true}, true},
		// A Windows Engineer is unrestricted inside its own ecosystem, but role
		// administration would let it grant itself the other one.
		{"windows high does not administer", UserRole{PlatformScope: PlatformScopeWindows, AccessLevel: AccessLevelHigh}, false},
		{"android high does not administer", UserRole{PlatformScope: PlatformScopeAndroid, AccessLevel: AccessLevelHigh}, false},
		{"global mid does not administer", UserRole{PlatformScope: PlatformScopeGlobal, AccessLevel: AccessLevelMid}, false},
		{"global low does not administer", UserRole{PlatformScope: PlatformScopeGlobal, AccessLevel: AccessLevelLow}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.role.IsConsoleAdministrator(); got != tt.want {
				t.Errorf("IsConsoleAdministrator() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserRoleTableNameMatchesJavaSchema(t *testing.T) {
	// Liquibase creates `userRoles` unquoted, which PostgreSQL folds to lowercase.
	if got := (UserRole{}).TableName(); got != "userroles" {
		t.Errorf("TableName() = %q, want %q", got, "userroles")
	}
}
