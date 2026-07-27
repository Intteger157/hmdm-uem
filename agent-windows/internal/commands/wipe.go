//go:build windows

package commands

import (
	"fmt"
	"os/exec"
	"syscall"
)

const (
	factoryWipeSuccessMessage = "Factory wipe initiated. Device is rebooting to reset."
	factoryWipeScript         = "Invoke-CimMethod -Namespace 'root\\cimv2\\mdm\\dmmap' -ClassName 'MDM_RemoteWipe' -MethodName 'doWipeMethod'"
)

func factoryWipe() Result {
	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-ExecutionPolicy", "Bypass",
		"-WindowStyle", "Hidden",
		"-Command", factoryWipeScript,
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	if err := cmd.Start(); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("factory wipe failed to start: %v", err)}
	}

	go func() {
		_ = cmd.Wait()
	}()

	return Result{Success: true, Message: factoryWipeSuccessMessage}
}
