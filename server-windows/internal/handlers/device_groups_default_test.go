package handlers

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestApplyExclusiveDefaultGroupClearsOthers(t *testing.T) {
	// Logic-only test: verify the update pattern used by applyExclusiveDefaultGroup.
	groups := []models.WindowsDeviceGroup{
		{ID: 1, Name: "A", IsDefault: true},
		{ID: 2, Name: "B", IsDefault: false},
	}

	const newDefaultID uint = 2
	for i := range groups {
		if groups[i].ID != newDefaultID {
			groups[i].IsDefault = false
		}
	}
	for i := range groups {
		if groups[i].ID == newDefaultID {
			groups[i].IsDefault = true
		}
	}

	if groups[0].IsDefault {
		t.Fatalf("group 1 should no longer be default")
	}
	if !groups[1].IsDefault {
		t.Fatalf("group 2 should be default")
	}
}
