//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"
)

func enforceDefender(enabled bool) Result {
	name := "Defender"
	disableMonitoring := "$true"
	if enabled {
		disableMonitoring = "$false"
	}

	script := fmt.Sprintf(
		"$ErrorActionPreference = 'Stop'; Set-MpPreference -DisableRealtimeMonitoring %s",
		disableMonitoring,
	)
	output, err := runPowerShellScript(script, 2*time.Minute)
	if err != nil {
		return Result{Name: name, Success: false, Message: output}
	}
	if output == "" {
		output = fmt.Sprintf("realtime monitoring set to %v", enabled)
	}
	return Result{Name: name, Success: true, Message: output}
}

func readDefenderEnabled() (bool, error) {
	output, err := runPowerShellScript(
		"$ErrorActionPreference = 'Stop'; $pref = Get-MpPreference; if ($pref.DisableRealtimeMonitoring) { 'off' } else { 'on' }",
		2*time.Minute,
	)
	if err != nil {
		return false, err
	}
	return strings.EqualFold(strings.TrimSpace(output), "on"), nil
}
