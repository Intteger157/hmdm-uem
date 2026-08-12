package handlers

import "testing"

func TestNeedsPostEnrollmentSwitch(t *testing.T) {
	t.Parallel()

	if !needsPostEnrollmentSwitch([]uint{4}, 9) {
		t.Fatal("expected a switch when the device sits on the enrollment profile")
	}
	if !needsPostEnrollmentSwitch(nil, 9) {
		t.Fatal("expected a switch when the device has no direct assignment")
	}
	if !needsPostEnrollmentSwitch([]uint{4, 9}, 9) {
		t.Fatal("expected a switch when extra direct profiles are still linked")
	}
	if needsPostEnrollmentSwitch([]uint{9}, 9) {
		t.Fatal("expected a repeated signal to be a no-op")
	}
	if needsPostEnrollmentSwitch([]uint{4}, 0) {
		t.Fatal("expected no switch without a post-enrollment profile")
	}
}
