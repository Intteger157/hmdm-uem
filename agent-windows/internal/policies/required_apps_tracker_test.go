//go:build windows

package policies

import (
	"testing"

	"github.com/hmdm/agent-windows/internal/apps"
)

func TestRequiredAppIDTracker(t *testing.T) {
	UpdateRequiredAppIDs([]apps.RequiredApp{
		{ID: 10, Name: "A"},
		{ID: 20, Name: "B"},
	})

	if !IsRequiredAppID(10) || !IsRequiredAppID(20) {
		t.Fatal("expected tracked app IDs to be required")
	}
	if IsRequiredAppID(99) {
		t.Fatal("expected unknown app ID to be not required")
	}

	UpdateRequiredAppIDs(nil)
	if IsRequiredAppID(10) {
		t.Fatal("expected removed app ID to be not required")
	}

	requiredAppsMu.Lock()
	requiredAppsInitialized = false
	requiredAppsMu.Unlock()
	if !IsRequiredAppID(10) {
		t.Fatal("expected unknown tracker state to allow deployment")
	}
}
