//go:build windows

package apps

import (
	"log"
	"strings"

	"github.com/hmdm/agent-windows/internal/brand"
	"github.com/hmdm/agent-windows/internal/procexec"
	"github.com/shirou/gopsutil/v4/process"
)

// cleanupManagedInstallerProcesses terminates orphaned agent-managed installer
// processes (e.g. NSIS _*.tmp children left after a failed silent install).
func cleanupManagedInstallerProcesses() {
	procs, err := process.Processes()
	if err != nil {
		log.Printf("app install cleanup: list processes: %v", err)
		return
	}

	killed := 0
	for _, proc := range procs {
		if proc == nil {
			continue
		}
		name, err := proc.Name()
		if err != nil || !isManagedInstallerProcessName(name) {
			continue
		}
		pid := int(proc.Pid)
		if err := procexec.KillProcessTree(pid); err != nil {
			log.Printf("app install cleanup: kill %s pid=%d: %v", name, pid, err)
			continue
		}
		killed++
		log.Printf("app install cleanup: killed %s pid=%d", name, pid)
	}
	if killed > 0 {
		log.Printf("app install cleanup: terminated %d managed installer process(es)", killed)
	}
}

func isManagedInstallerProcessName(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	// Only app-deployment download temps (NSIS often leaves *_*.tmp children).
	// Do not touch singularity-mdm-install-* used by detached agent self-update.
	return strings.HasPrefix(lower, strings.ToLower(brand.DownloadTempPrefix))
}

func cleanupInstallerProcessTree(pid int) {
	if pid <= 0 {
		return
	}
	if err := procexec.KillProcessTree(pid); err != nil {
		log.Printf("app install cleanup: kill installer tree pid=%d: %v", pid, err)
	}
	cleanupManagedInstallerProcesses()
}
