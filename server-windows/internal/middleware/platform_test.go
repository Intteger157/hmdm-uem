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
