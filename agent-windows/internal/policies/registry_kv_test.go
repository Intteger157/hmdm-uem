//go:build windows

package policies

import "testing"

func TestParseRegistryPolicyPath(t *testing.T) {
	t.Parallel()

	parsed, err := parseRegistryPolicyPath(`HKLM\Software\Policies\Microsoft\Windows\Personalization\NoLockScreen`)
	if err != nil {
		t.Fatalf("parseRegistryPolicyPath() error = %v", err)
	}
	if parsed.valueName != "NoLockScreen" {
		t.Fatalf("valueName = %q, want NoLockScreen", parsed.valueName)
	}
	if parsed.keyPath != `Software\Policies\Microsoft\Windows\Personalization` {
		t.Fatalf("keyPath = %q", parsed.keyPath)
	}
}

func TestParseRegistryPolicyPathRejectsInvalidPath(t *testing.T) {
	t.Parallel()

	if _, err := parseRegistryPolicyPath(`HKLM\OnlyHive`); err == nil {
		t.Fatal("expected error for invalid policy path")
	}
}

func TestParseDwordValue(t *testing.T) {
	t.Parallel()

	value, err := parseDwordValue("0x1")
	if err != nil {
		t.Fatalf("parseDwordValue() error = %v", err)
	}
	if value != 1 {
		t.Fatalf("value = %d, want 1", value)
	}
}
