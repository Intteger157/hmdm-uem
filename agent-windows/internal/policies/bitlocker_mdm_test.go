//go:build windows

package policies

import (
	"strings"
	"testing"
)

func TestApplyBitLockerMDMPolicyScriptUsesFilteredWMIWithCreateFallback(t *testing.T) {
	t.Parallel()

	if !strings.Contains(applyBitLockerMDMPolicyScript, "MDM_Policy_Config01_BitLocker02") {
		t.Fatalf("script = %q, expected BitLocker MDM class", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "InstanceID='BitLocker' and ParentID='./Vendor/MSFT/Policy/Config'") {
		t.Fatalf("script = %q, expected BitLocker CSP filter", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "Get-CimInstance -Namespace $namespace -ClassName $className -Filter $filter -ErrorAction SilentlyContinue") {
		t.Fatalf("script = %q, expected filtered Get-CimInstance", applyBitLockerMDMPolicyScript)
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
	if strings.Contains(applyBitLockerMDMPolicyScript, "manage-bde") || strings.Contains(applyBitLockerMDMPolicyScript, "Enable-BitLocker") {
		t.Fatalf("script = %q, should not use legacy BitLocker activation commands", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, bitLockerMDMPolicyAppliedOutput) {
		t.Fatalf("script = %q, expected MDM Bridge success marker", applyBitLockerMDMPolicyScript)
	}
}
