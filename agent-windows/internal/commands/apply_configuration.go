//go:build windows

package commands

import (
	"strings"
	"sync"
)

var (
	applyConfigurationMu      sync.RWMutex
	applyConfigurationHandler func() (string, error)
)

// SetApplyConfigurationHandler registers the function that evaluates and applies configuration.
func SetApplyConfigurationHandler(fn func() (string, error)) {
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
	report, err := fn()
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}
	report = strings.TrimSpace(report)
	if report == "" {
		report = "configuration apply started"
	}
	return Result{Success: true, Message: report}
}
