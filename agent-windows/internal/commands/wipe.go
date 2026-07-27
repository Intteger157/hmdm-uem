//go:build windows

package commands

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	factoryWipeSuccessMessage = "Factory reset initiated via MDM_RemoteWipe"
)

var (
	afterFactoryResetMu sync.RWMutex
	afterFactoryResetFn func()
	startFactoryReset   = defaultStartFactoryReset
)

// SetAfterFactoryResetStarted registers a callback invoked after factory wipe starts.
func SetAfterFactoryResetStarted(fn func()) {
	afterFactoryResetMu.Lock()
	afterFactoryResetFn = fn
	afterFactoryResetMu.Unlock()
}

func factoryWipe() Result {
	if err := startFactoryReset(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("factory reset failed: %v", err)}
	}

	runAfterFactoryResetStarted()

	return Result{Success: true, Message: factoryWipeSuccessMessage}
}

func buildFactoryWipeScript() string {
	return fmt.Sprintf(
		"try { Get-CimInstance -Namespace ROOT\\CIMv2\\mdm\\dmmap -ClassName MDM_RemoteWipe | Invoke-CimMethod -MethodName doWipeMethod -Arguments @{param=''} -ErrorAction Stop; Write-Output '%s' } catch { throw $_ }",
		factoryWipeSuccessMessage,
	)
}

func defaultStartFactoryReset() error {
	stdout, stderr, err := runPowerShellScript(buildFactoryWipeScript())
	combined := strings.TrimSpace(stderr)
	if combined == "" {
		combined = strings.TrimSpace(stdout)
	}
	if err != nil {
		if combined != "" {
			return fmt.Errorf("%s", combined)
		}
		return err
	}
	return nil
}

func runAfterFactoryResetStarted() {
	afterFactoryResetMu.RLock()
	fn := afterFactoryResetFn
	afterFactoryResetMu.RUnlock()
	if fn != nil {
		fn()
	}
}

// DefaultAfterFactoryResetExit stops the agent shortly after reset starts so status can flush first.
func DefaultAfterFactoryResetExit() {
	go func() {
		time.Sleep(3 * time.Second)
		os.Exit(0)
	}()
}
