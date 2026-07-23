//go:build windows

package policies

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func enforceScreenLockTimeout(minutes int) Result {
	name := "ScreenLock"
	if minutes <= 0 {
		outputAC, errAC := runCommand("powercfg.exe", "/change", "monitor-timeout-ac", "0")
		outputDC, errDC := runCommand("powercfg.exe", "/change", "monitor-timeout-dc", "0")
		if errAC != nil {
			return Result{Name: name, Success: false, Message: outputAC}
		}
		if errDC != nil {
			return Result{Name: name, Success: false, Message: outputDC}
		}
		return Result{Name: name, Success: true, Message: "monitor timeout disabled (0 minutes)"}
	}

	value := strconv.Itoa(minutes)
	outputAC, errAC := runCommand("powercfg.exe", "/change", "monitor-timeout-ac", value)
	if errAC != nil {
		return Result{Name: name, Success: false, Message: outputAC}
	}
	outputDC, errDC := runCommand("powercfg.exe", "/change", "monitor-timeout-dc", value)
	if errDC != nil {
		return Result{Name: name, Success: false, Message: outputDC}
	}

	message := strings.TrimSpace(outputAC)
	if message == "" {
		message = fmt.Sprintf("monitor timeout set to %d minute(s)", minutes)
	}
	if strings.TrimSpace(outputDC) != "" {
		message = message + "; " + strings.TrimSpace(outputDC)
	}
	return Result{Name: name, Success: true, Message: message}
}

func readScreenLockTimeout() (int, error) {
	script := `
$ErrorActionPreference = 'SilentlyContinue'
$out = powercfg /query SCHEME_CURRENT SUB VIDEO
if (-not $out) { exit 0 }
function Get-Minutes($label) {
  $line = $out | Where-Object { $_ -match $label } | Select-Object -First 1
  if (-not $line) { return 0 }
  if ($line -notmatch '0x[0-9a-fA-F]+') { return 0 }
  $hex = ($Matches[0] -replace '0x','')
  $seconds = [Convert]::ToInt32($hex, 16)
  return [math]::Round($seconds / 60)
}
$ac = Get-Minutes('AC Power Setting Index')
$dc = Get-Minutes('DC Power Setting Index')
if ($ac -gt 0) { $ac } elseif ($dc -gt 0) { $dc } else { 0 }
`
	output, err := runPowerShellScript(script, 2*time.Minute)
	if err != nil {
		return 0, err
	}
	output = strings.TrimSpace(output)
	if output == "" {
		return 0, nil
	}
	minutes, err := strconv.Atoi(output)
	if err != nil {
		return 0, fmt.Errorf("parse monitor timeout: %w", err)
	}
	return minutes, nil
}
