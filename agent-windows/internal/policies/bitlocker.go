//go:build windows

package policies

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

const (
	bitLockerRecoveryKeyPrefix = "RECOVERY_KEY:"
	bitLockerScriptTimeout     = 10 * time.Minute
)

var bitLockerRecoveryKeyPattern = regexp.MustCompile(`\b(?:\d{6}-){7}\d{6}\b`)

const enableBitLockerScript = `
$ErrorActionPreference = 'Stop'
$WarningPreference = 'SilentlyContinue'
Import-Module BitLocker -ErrorAction SilentlyContinue
$vol = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction Stop
$status = $vol.VolumeStatus.ToString()
if ($status -ne 'FullyEncrypted' -and $status -ne 'EncryptionInProgress') {
  Add-BitLockerKeyProtector -MountPoint 'C:' -RecoveryPasswordProtector
  Enable-BitLocker -MountPoint 'C:' -SkipHardwareTest
  $vol = Get-BitLockerVolume -MountPoint 'C:' -ErrorAction Stop
}
$protector = $vol.KeyProtector | Where-Object { $_.KeyProtectorType -eq 'RecoveryPassword' } | Select-Object -First 1
if ($null -eq $protector) { throw 'recovery password protector not found' }
$id = $protector.KeyProtectorId
try { manage-bde -protectors -adbackup C: -id $id 2>$null | Out-Null } catch {}
Write-Output $protector.RecoveryPassword
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
	if err != nil {
		return Result{Name: "BitLocker", Success: false, Message: fmt.Sprintf("enable failed: %v", err)}
	}

	recoveryKey := extractBitLockerRecoveryKeyFromOutput(output)
	if recoveryKey == "" {
		return Result{Name: "BitLocker", Success: false, Message: "BitLocker started but recovery key was not returned"}
	}

	return Result{
		Name:    "BitLocker",
		Success: true,
		Message: bitLockerRecoveryKeyPrefix + recoveryKey,
	}
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

func extractBitLockerRecoveryKeyFromOutput(output string) string {
	match := bitLockerRecoveryKeyPattern.FindString(output)
	return strings.TrimSpace(match)
}

func ExtractBitLockerRecoveryKey(results []Result) string {
	for _, result := range results {
		if result.Name != "BitLocker" || !result.Success {
			continue
		}
		if strings.HasPrefix(result.Message, bitLockerRecoveryKeyPrefix) {
			return strings.TrimSpace(strings.TrimPrefix(result.Message, bitLockerRecoveryKeyPrefix))
		}
	}
	return ""
}

func sanitizeResultMessage(message string) string {
	if strings.HasPrefix(message, bitLockerRecoveryKeyPrefix) {
		return "recovery key escrowed"
	}
	return message
}
