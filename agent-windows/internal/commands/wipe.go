//go:build windows

package commands

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

const (
	factoryResetExecutable    = "systemreset.exe"
	factoryResetArgFactory    = "-factoryreset"
	factoryWipeSuccessMessage = "Factory reset initiated via systemreset.exe"
)

var (
	afterFactoryResetMu sync.RWMutex
	afterFactoryResetFn func()
	startFactoryReset   = defaultStartFactoryReset
)

// SetAfterFactoryResetStarted registers a callback invoked after systemreset.exe starts.
func SetAfterFactoryResetStarted(fn func()) {
	afterFactoryResetMu.Lock()
	afterFactoryResetFn = fn
	afterFactoryResetMu.Unlock()
}

func factoryWipe() Result {
	if err := startFactoryReset(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("factory reset failed to start: %v", err)}
	}

	runAfterFactoryResetStarted()

	return Result{Success: true, Message: factoryWipeSuccessMessage}
}

func defaultStartFactoryReset() error {
	cmd := newFactoryResetCommand()
	if err := cmd.Start(); err != nil {
		return err
	}
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}

func newFactoryResetCommand() *exec.Cmd {
	cmd := exec.Command(factoryResetExecutable, factoryResetArgFactory)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
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
