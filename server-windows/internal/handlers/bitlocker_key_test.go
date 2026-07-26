package handlers

import "testing"

func TestSubmitBitLockerKeyRequestNormalizedKey(t *testing.T) {
	t.Parallel()

	req := submitBitLockerKeyRequest{
		RecoveryKey: " 111111-222222-333333-444444-555555-666666-777777-888888 ",
	}
	if got := req.normalizedKey(); got != "111111-222222-333333-444444-555555-666666-777777-888888" {
		t.Fatalf("recoveryKey normalized = %q", got)
	}

	req = submitBitLockerKeyRequest{
		BitLockerKey: "999999-888888-777777-666666-555555-444444-333333-222222",
	}
	if got := req.normalizedKey(); got != req.BitLockerKey {
		t.Fatalf("bitlocker_key normalized = %q", got)
	}
}
