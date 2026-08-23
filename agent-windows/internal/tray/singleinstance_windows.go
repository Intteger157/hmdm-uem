//go:build windows

package tray

import (
	"fmt"
	"os/exec"
	"strings"
	"syscall"

	"github.com/hmdm/agent-windows/internal/brand"
	"golang.org/x/sys/windows"
)

const traySingletonMutexName = `Global\SingularityMDMAgentTray`

var traySingletonHandle windows.Handle

// AcquireSingleInstance ensures only one tray helper runs per machine.
// Returns false when another instance already owns the mutex.
func AcquireSingleInstance() bool {
	name, err := windows.UTF16PtrFromString(traySingletonMutexName)
	if err != nil {
		return true
	}

	handle, err := windows.CreateMutex(nil, false, name)
	if err != nil {
		return true
	}

	if windows.GetLastError() == windows.ERROR_ALREADY_EXISTS {
		windows.CloseHandle(handle)
		return false
	}

	traySingletonHandle = handle
	return true
}

// StopExistingTrayHelpers terminates orphaned tray helpers before the service
// launches a fresh one. Safe to call from the Windows service process.
func StopExistingTrayHelpers() {
	script := fmt.Sprintf(
		`Get-CimInstance Win32_Process -Filter "Name='%s'" | Where-Object { $_.CommandLine -like '*-tray*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
		brand.TrayExecutableName(),
	)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := cmd.CombinedOutput(); err != nil {
		text := strings.TrimSpace(string(output))
		if text != "" {
			// Best-effort cleanup; log and continue when no tray processes exist.
			return
		}
	}
}
