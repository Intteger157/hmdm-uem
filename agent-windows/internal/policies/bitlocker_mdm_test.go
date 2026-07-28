//go:build windows

package policies

import (
	"strings"
	"testing"
)

func TestApplyBitLockerMDMPolicyScriptUsesDedicatedBitLockerCSP(t *testing.T) {
	t.Parallel()

	if !strings.Contains(applyBitLockerMDMPolicyScript, "MDM_BitLocker") {
		t.Fatalf("script = %q, expected dedicated BitLocker MDM class", applyBitLockerMDMPolicyScript)
	}
	if strings.Contains(applyBitLockerMDMPolicyScript, "MDM_Policy_Config01_BitLocker02") {
		t.Fatalf("script = %q, should not use generic Policy CSP class", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "Get-CimInstance -Namespace $namespace -ClassName $className -ErrorAction SilentlyContinue") {
		t.Fatalf("script = %q, expected unfiltered Get-CimInstance", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "ParentID = './Vendor/MSFT'") {
		t.Fatalf("script = %q, expected BitLocker CSP ParentID", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "New-CimInstance -Namespace $namespace -ClassName $className -Property $props -ErrorAction Stop") {
		t.Fatalf("script = %q, expected New-CimInstance fallback", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "Set-CimInstance -InputObject $instance -ErrorAction Stop") {
		t.Fatalf("script = %q, expected Set-CimInstance update path", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "RequireDeviceEncryption = 1") {
		t.Fatalf("script = %q, expected device encryption requirement", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "AllowWarningForOtherDiskEncryption = 0") {
		t.Fatalf("script = %q, expected warning suppression property", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "AllowStandardUserEncryption = 1") {
		t.Fatalf("script = %q, expected standard user encryption property", applyBitLockerMDMPolicyScript)
	}
	if strings.Contains(applyBitLockerMDMPolicyScript, "manage-bde") || strings.Contains(applyBitLockerMDMPolicyScript, "Enable-BitLocker") {
		t.Fatalf("script = %q, should not use legacy BitLocker activation commands", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, bitLockerMDMPolicyAppliedOutput) {
		t.Fatalf("script = %q, expected dedicated BitLocker CSP success marker", applyBitLockerMDMPolicyScript)
	}
}
