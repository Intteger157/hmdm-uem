package db

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestLegacyPermissionSourceRoleID(t *testing.T) {
	tests := []struct {
		name string
		seed models.UserRole
		want uint
	}{
		{
			name: "Global Administrator mirrors Admin",
			seed: models.UserRole{Name: "Global Administrator", AccessLevel: models.AccessLevelHigh},
			want: legacyAdminRoleID,
		},
		{
			name: "Engineer mirrors Admin",
			seed: models.UserRole{Name: "Android Engineer", AccessLevel: models.AccessLevelHigh},
			want: legacyAdminRoleID,
		},
		{
			name: "Operator mirrors User",
			seed: models.UserRole{Name: "Windows Operator", AccessLevel: models.AccessLevelMid},
			want: legacyUserRoleID,
		},
		{
			name: "Observer mirrors User",
			seed: models.UserRole{Name: "Windows Observer", AccessLevel: models.AccessLevelLow},
			want: legacyUserRoleID,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := legacyPermissionSourceRoleID(tc.seed); got != tc.want {
				t.Errorf("legacyPermissionSourceRoleID() = %d, want %d", got, tc.want)
			}
		})
	}
}
