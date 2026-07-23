//go:build windows

package system

import "testing"

func TestParseManageBDEStatusOutput(t *testing.T) {
	sample := `
BitLocker Drive Encryption: Configuration Tool version 10.0.26100

Volume C: [OS Volume]
    Size:                 999.14 GB
    Conversion Status:    Fully Encrypted
    Protection Status:    Protection On

Volume D: [Files Volume]
    Size:                 256.06 GB
    Conversion Status:    Fully Decrypted
    Protection Status:    Protection Off
    Lock Status:          Unlocked

Volume E:
    Size:                 238.47 GB
    Conversion Status:    Fully Encrypted
    Protection Status:    Protection On
    Lock Status:          Locked
`

	statuses := parseManageBDEStatusOutput(sample)
	if statuses["C:"] != "on" {
		t.Fatalf("C: expected on, got %q", statuses["C:"])
	}
	if statuses["D:"] != "off" {
		t.Fatalf("D: expected off, got %q", statuses["D:"])
	}
	if statuses["E:"] != "on" {
		t.Fatalf("E: expected on (locked), got %q", statuses["E:"])
	}
}

func TestMapProtectionStatusUnprotectedIgnoresConversion(t *testing.T) {
	if got := mapProtectionStatus(0, 1); got != "off" {
		t.Fatalf("unprotected volume with stale conversion=1 should be off, got %q", got)
	}
}

func TestManageBDETextLockedIgnoresUnlocked(t *testing.T) {
	if manageBDETextLocked("lock status:          unlocked") {
		t.Fatal("unlocked volume must not match locked")
	}
	if !manageBDETextLocked("lock status:          locked") {
		t.Fatal("locked volume must match locked")
	}
}

func TestQueryManageBDEStatusUnlockedVolumeIsOff(t *testing.T) {
	text := `
volume d: [files volume]
    conversion status:    fully decrypted
    protection status:    protection off
    lock status:          unlocked
`
	if manageBDEIndicatesOn(text) {
		t.Fatal("unlocked decrypted volume must not indicate on")
	}
	if !manageBDEIndicatesOff(text) {
		t.Fatal("unlocked decrypted volume must indicate off")
	}
}

func TestSummarizeDiskEncryptionPartial(t *testing.T) {
	volumes := []DiskVolumeInfo{
		{MountPoint: "C:", EncryptStatus: "on"},
		{MountPoint: "D:", EncryptStatus: "off"},
		{MountPoint: "E:", EncryptStatus: "on"},
	}
	_, status, encrypted := summarizeDiskEncryption(volumes)
	if status != "partial" {
		t.Fatalf("expected partial, got %q", status)
	}
	if encrypted {
		t.Fatal("expected diskEncrypted=false for partial")
	}
}
