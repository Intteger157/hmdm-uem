//go:build windows

package policies

import (
	"sync"

	"github.com/hmdm/agent-windows/internal/apps"
)

var (
	requiredAppsMu            sync.RWMutex
	requiredAppIDs            = map[uint]struct{}{}
	requiredAppsInitialized   bool
)

// UpdateRequiredAppIDs stores the latest required application IDs from effective configuration.
func UpdateRequiredAppIDs(required []apps.RequiredApp) {
	requiredAppsMu.Lock()
	defer requiredAppsMu.Unlock()

	requiredAppsInitialized = true
	requiredAppIDs = make(map[uint]struct{}, len(required))
	for _, app := range required {
		if app.ID == 0 {
			continue
		}
		requiredAppIDs[app.ID] = struct{}{}
	}
}

// IsRequiredAppID reports whether the app is still required by the latest cached configuration.
func IsRequiredAppID(appID uint) bool {
	if appID == 0 {
		return false
	}

	requiredAppsMu.RLock()
	defer requiredAppsMu.RUnlock()
	if !requiredAppsInitialized {
		return true
	}
	_, ok := requiredAppIDs[appID]
	return ok
}

// InitRequiredAppIDsFromCache loads the tracker from locally cached desired configuration.
func InitRequiredAppIDsFromCache() {
	config, err := LoadDesiredConfig()
	if err != nil || config.UpdatedAt == "" {
		return
	}
	UpdateRequiredAppIDs(config.RequiredApps)
}
