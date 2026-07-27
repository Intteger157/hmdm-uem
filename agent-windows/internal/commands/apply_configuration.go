//go:build windows

package commands

import "sync"

var (
	applyConfigurationMu      sync.RWMutex
	applyConfigurationHandler func()
)

// SetApplyConfigurationHandler registers the function that fetches and applies configuration.
func SetApplyConfigurationHandler(fn func()) {
	applyConfigurationMu.Lock()
	applyConfigurationHandler = fn
	applyConfigurationMu.Unlock()
}

func executeApplyConfiguration() Result {
	applyConfigurationMu.RLock()
	fn := applyConfigurationHandler
	applyConfigurationMu.RUnlock()

	if fn == nil {
		return Result{Success: false, Message: "apply configuration handler not configured"}
	}
	fn()
	return Result{Success: true, Message: "configuration apply started"}
}
