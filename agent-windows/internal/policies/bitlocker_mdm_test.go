//go:build windows

package policies

import (
	"strings"
	"testing"
)

func TestApplyBitLockerMDMPolicyScriptUsesSingletonWMI(t *testing.T) {
	t.Parallel()

	if !strings.Contains(applyBitLockerMDMPolicyScript, "MDM_Policy_Config01_BitLocker02") {
		t.Fatalf("script = %q, expected BitLocker MDM class", applyBitLockerMDMPolicyScript)
	}
	if !strings.Contains(applyBitLockerMDMPolicyScript, "Get-CimInstance -Namespace $namespace -ClassName $className -ErrorAction Stop") {
		t.Fatalf("script = %q, expected singleton Get-CimInstance", applyBitLockerMDMPolicyScript)
	}
	if strings.Contains(applyBitLockerMDMPolicyScript, "-Filter") || strings.Contains(applyBitLockerMDMPolicyScript, "New-CimInstance") {
		t.Fatalf("script = %q, should not filter or create MDM policy instances", applyBitLockerMDMPolicyScript)
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
