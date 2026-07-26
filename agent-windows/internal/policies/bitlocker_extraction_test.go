package policies

import (
	"errors"
	"testing"
)

func TestExtractBitLockerRecoveryKeyFromOutput(t *testing.T) {
	t.Parallel()

	output := `
BitLocker Drive Encryption: Configuration Tool version 10.0.26100
ERROR: An error occurred (0x8031004e): You must restart your computer before BitLocker can encrypt this volume.
Numerical Password:
    123456-234567-345678-456789-567890-678901-789012-890123
`
	key := extractBitLockerRecoveryKeyFromOutput(output)
	want := "123456-234567-345678-456789-567890-678901-789012-890123"
	if key != want {
		t.Fatalf("key = %q, want %q", key, want)
	}
}

func TestIsBitLockerRebootRequired(t *testing.T) {
	t.Parallel()

	output := "ERROR: An error occurred (0x8031004e): You must restart your computer before BitLocker can encrypt this volume."
	if !isBitLockerRebootRequired(output, errors.New("exit status 1")) {
		t.Fatal("expected reboot required")
	}
}

func TestBuildBitLockerEnableResultEscrowsKeyDespiteCommandError(t *testing.T) {
	t.Parallel()

	output := `
123456-111111-222222-333333-444444-555555-666666-777777
ERROR: An error occurred (0x8031004e): You must restart your computer before BitLocker can encrypt this volume.
`
	outcome := evaluateBitLockerEnableOutput(output, errors.New(output))
	result := buildBitLockerEnableResult(outcome)

	if !result.Success {
		t.Fatalf("expected success, got %#v", result)
	}
	if !outcome.RebootRequired {
		t.Fatal("expected reboot required outcome")
	}
	key := extractRecoveryKeyFromResultMessage(result.Message)
	if key != "123456-111111-222222-333333-444444-555555-666666-777777" {
		t.Fatalf("key = %q", key)
	}
	if ExtractBitLockerRecoveryKey([]Result{result}) != key {
		t.Fatal("ExtractBitLockerRecoveryKey failed")
	}
}

func TestBuildBitLockerEnableResultPendingRebootWithoutKey(t *testing.T) {
	t.Parallel()

	output := "ERROR: An error occurred (0x8031004e): You must restart your computer before BitLocker can encrypt this volume."
	result := buildBitLockerEnableResult(evaluateBitLockerEnableOutput(output, errors.New(output)))

	if !result.Success {
		t.Fatalf("expected pending reboot success, got %#v", result)
	}
	if result.Message != bitLockerPendingRebootNote+": reboot required to continue BitLocker encryption" {
		t.Fatalf("message = %q", result.Message)
	}
}

func TestBuildBitLockerEnableResultFailsWithoutKeyOrReboot(t *testing.T) {
	t.Parallel()

	result := buildBitLockerEnableResult(evaluateBitLockerEnableOutput("access denied", errors.New("access denied")))
	if result.Success {
		t.Fatal("expected failure")
	}
}
