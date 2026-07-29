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

func TestUserRoleTableNameMatchesJavaSchema(t *testing.T) {
	// Liquibase creates `userRoles` unquoted, which PostgreSQL folds to lowercase.
	if got := (UserRole{}).TableName(); got != "userroles" {
		t.Errorf("TableName() = %q, want %q", got, "userroles")
	}
}
