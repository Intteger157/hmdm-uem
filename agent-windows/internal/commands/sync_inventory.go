//go:build windows

package commands

import "sync"

var (
	syncInventoryMu      sync.RWMutex
	syncInventoryHandler func() error
)

// SetSyncInventoryHandler registers the function that collects and uploads inventory.
func SetSyncInventoryHandler(fn func() error) {
	syncInventoryMu.Lock()
	syncInventoryHandler = fn
	syncInventoryMu.Unlock()
}

func executeSyncInventory() Result {
	syncInventoryMu.RLock()
	fn := syncInventoryHandler
	syncInventoryMu.RUnlock()

	if fn == nil {
		return Result{Success: false, Message: "sync inventory handler not configured"}
	}
	if err := fn(); err != nil {
		return Result{Success: false, Message: err.Error()}
	}
	return Result{Success: true, Message: "inventory uploaded"}
}
