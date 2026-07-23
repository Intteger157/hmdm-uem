//go:build windows

// One-off helper: run from an elevated (Administrator) terminal:
//   go run ./cmd/inventory-test
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"

	"github.com/hmdm/agent-windows/internal/system"
)

func main() {
	warnIfBitLockerAccessDenied()

	info, err := system.CollectInfo()
	if err != nil {
		fmt.Fprintf(os.Stderr, "collect failed: %v\n", err)
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(info); err != nil {
		fmt.Fprintf(os.Stderr, "encode failed: %v\n", err)
		os.Exit(1)
	}
}

func warnIfBitLockerAccessDenied() {
	cmd := exec.Command("manage-bde.exe", "-status")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	text := strings.ToLower(string(output))
	if err != nil && strings.Contains(text, "access") && strings.Contains(text, "denied") {
		fmt.Fprintln(os.Stderr, "WARNING: manage-bde access denied — BitLocker status will be unknown.")
		fmt.Fprintln(os.Stderr, "Re-run this command in an Administrator PowerShell for accurate results.")
		fmt.Fprintln(os.Stderr, "The HMDMAgent Windows service runs elevated; use Sync in the panel after updating the agent.")
	}
}
