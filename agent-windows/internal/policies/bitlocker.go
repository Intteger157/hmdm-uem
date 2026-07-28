//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"
)

const bitLockerScriptTimeout = 10 * time.Minute

const applyBitLockerMDMPolicyScript = `try { 
    $namespace = 'ROOT\CIMv2\mdm\dmmap'
    $className = 'MDM_Policy_Config01_BitLocker02'
    
    $instance = Get-CimInstance -Namespace $namespace -ClassName $className -ErrorAction Stop
    
    $instance.RequireDeviceEncryption = 1
    $instance.AllowWarningForOtherDiskEncryption = 0
    $instance.AllowStandardUserEncryption = 1

    Set-CimInstance -InputObject $instance -ErrorAction Stop 
    
    Write-Output 'BitLocker MDM policy successfully applied via WMI Bridge' 
} catch { throw $_ }`

const bitLockerMDMPolicyAppliedOutput = "BitLocker MDM policy successfully applied via WMI Bridge"

// ApplyBitLockerMDMPolicy enables BitLocker through the MDM Bridge policy singleton.
func ApplyBitLockerMDMPolicy() Result {
	output, err := runPowerShellScript(applyBitLockerMDMPolicyScript, bitLockerScriptTimeout)
	if err != nil {
		message := strings.TrimSpace(output)
		if message == "" {
			message = err.Error()
		}
		return Result{Name: "BitLocker", Success: false, Message: message}
	}

	message := strings.TrimSpace(output)
	if message == "" {
		message = bitLockerMDMPolicyAppliedOutput
	}
	return Result{Name: "BitLocker", Success: true, Message: message}
}

func enforceRequireBitLocker(required bool) Result {
	if !required {
		return Result{Name: "BitLocker", Success: true, Message: "not required"}
	}

	if encrypted, err := readBitLockerEncrypted(); err != nil {
		return Result{Name: "BitLocker", Success: false, Message: err.Error()}
	} else if encrypted {
		return Result{Name: "BitLocker", Success: true, Message: "already encrypted on C:"}
	}

	return ApplyBitLockerMDMPolicy()
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
