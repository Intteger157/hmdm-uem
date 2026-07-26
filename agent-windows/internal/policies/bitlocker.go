//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"
)

const bitLockerScriptTimeout = 10 * time.Minute

const enableBitLockerScript = `
$ErrorActionPreference = 'Continue'
$WarningPreference = 'SilentlyContinue'
Import-Module BitLocker -ErrorAction SilentlyContinue
$vol = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction Stop
$status = $vol.VolumeStatus.ToString()
if ($status -ne 'FullyEncrypted' -and $status -ne 'EncryptionInProgress') {
  Add-BitLockerKeyProtector -MountPoint 'C:' -RecoveryPasswordProtector
  $vol = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction Stop
  $protector = $vol.KeyProtector | Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' } | Select-Object -First 1
  if ($null -eq $protector) { throw 'recovery password protector not found' }
  Write-Output $protector.RecoveryPassword
  $id = $protector.KeyProtectorId
  try { manage-bde -protectors -adbackup C: -id $id 2>&1 | Out-String | Write-Output } catch { Write-Output $_.Exception.Message }
  Enable-BitLocker -MountPoint 'C:' -SkipHardwareTest 2>&1 | Out-String | Write-Output
} else {
  $protector = $vol.KeyProtector | Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' } | Select-Object -First 1
  if ($null -ne $protector) { Write-Output $protector.RecoveryPassword }
}
`

func enforceRequireBitLocker(required bool) Result {
	if !required {
		return Result{Name: "BitLocker", Success: true, Message: "not required"}
	}

	if encrypted, err := readBitLockerEncrypted(); err != nil {
		return Result{Name: "BitLocker", Success: false, Message: err.Error()}
	} else if encrypted {
		return Result{Name: "BitLocker", Success: true, Message: "already encrypted on C:"}
	}

	output, err := runPowerShellScript(enableBitLockerScript, bitLockerScriptTimeout)
	return buildBitLockerEnableResult(evaluateBitLockerEnableOutput(output, err))
}

func readBitLockerEncrypted() (bool, error) {
	script := `
$WarningPreference = 'SilentlyContinue'
Import-Module BitLocker -ErrorAction SilentlyContinue
$vol = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction SilentlyContinue
if ($null -eq $vol) { Write-Output 'unknown'; exit 0 }
switch ($vol.VolumeStatus.ToString()) {
  'FullyEncrypted' { Write-Output 'encrypted'; exit 0 }
  'EncryptionInProgress' { Write-Output 'encrypted'; exit 0 }
  default { Write-Output 'not_encrypted' }
}
`
	output, err := runPowerShellScript(script, 2*time.Minute)
	if err != nil {
		return false, fmt.Errorf("read BitLocker status: %w", err)
	}

	switch strings.ToLower(strings.TrimSpace(output)) {
	case "encrypted":
		return true, nil
	case "not_encrypted":
		return false, nil
	default:
		return false, fmt.Errorf("unknown BitLocker status: %s", strings.TrimSpace(output))
	}
}
