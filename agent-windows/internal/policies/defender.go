//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"
)

const defenderPolicyKeyPath = `SOFTWARE\Policies\Microsoft\Windows Defender`

func enforceDefender(enabled bool) Result {
	name := "Defender"
	if enabled {
		return enableDefenderMonitoring(name)
	}
	return removeDefenderPolicy(name)
}

func enableDefenderMonitoring(name string) Result {
	script := "$ErrorActionPreference = 'Stop'; Set-MpPreference -DisableRealtimeMonitoring $false"
	output, err := runPowerShellScript(script, 2*time.Minute)
	if err != nil {
		return Result{Name: name, Success: false, Message: output}
	}
	if strings.TrimSpace(output) == "" {
		output = "realtime monitoring enabled"
	}
	return Result{Name: name, Success: true, Message: output}
}

func removeDefenderPolicy(name string) Result {
	if err := deleteRegistryTree(registry.LOCAL_MACHINE, defenderPolicyKeyPath); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("remove policy key: %v", err)}
	}

	script := `
$ErrorActionPreference = 'SilentlyContinue'
Set-MpPreference -DisableRealtimeMonitoring $false
'Windows Defender policy keys removed; control returned to local settings.'
`
	output, err := runPowerShellScript(script, 2*time.Minute)
	if err != nil {
		if strings.TrimSpace(output) == "" {
			output = "policy keys removed"
		}
		return Result{Name: name, Success: true, Message: strings.TrimSpace(output)}
	}
	if strings.TrimSpace(output) == "" {
		output = "Windows Defender policy keys removed; control returned to local settings."
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

func hasDefenderPolicyKeys() bool {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, defenderPolicyKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	key.Close()
	return true
}
