package middleware

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestPlatformForPath(t *testing.T) {
	tests := []struct {
		path string
		want string
	}{
		{"/rest/windows/devices", models.PlatformScopeWindows},
		{"/rest/windows/configurations/12/apps", models.PlatformScopeWindows},
		{"/api/windows/register", models.PlatformScopeWindows},
		{"/api/terminal/admin", models.PlatformScopeWindows},
		{"/api/taskmgr/admin", models.PlatformScopeWindows},
		{"/api/filexplorer/admin", models.PlatformScopeWindows},
		{"/rest/android/devices", models.PlatformScopeAndroid},
		{"/api/android/enroll", models.PlatformScopeAndroid},
		// Role administration spans both ecosystems despite its Windows prefix.
		{"/rest/windows/roles", ""},
		{"/rest/windows/roles/3", ""},
		{"/api/windows/roles", ""},
		{"/api/windows/roles/3", ""},
		// The profile route reports the caller's own scope, so every operator
		// must be able to reach it regardless of the platform they manage.
		{"/rest/windows/me", ""},
		{"/api/windows/me", ""},
		{"/rest/windows/me/", ""},
		// An exemption must not leak onto routes that merely share its prefix.
		{"/rest/windows/messages", models.PlatformScopeWindows},
		{"/rest/windows/rolesets", models.PlatformScopeWindows},
		{"/rest/private/users/current", ""},
		{"/storage/apps/setup.msi", ""},
		{"/", ""},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			if got := PlatformForPath(tt.path); got != tt.want {
				t.Errorf("PlatformForPath(%q) = %q, want %q", tt.path, got, tt.want)
			}
		})
	}
}
