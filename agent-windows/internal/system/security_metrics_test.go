//go:build windows

package system

import "testing"

func TestParseRealTimeProtectionEnabled(t *testing.T) {
	if !parseRealTimeProtectionEnabled("True\r\n", nil) {
		t.Fatal("expected True to enable protection")
	}
	if parseRealTimeProtectionEnabled("False\r\n", nil) {
		t.Fatal("expected False to disable protection")
	}
	if parseRealTimeProtectionEnabled("True\r\n", assertErr("access denied")) {
		t.Fatal("expected error to disable protection")
	}
}

func assertErr(msg string) error {
	return &testError{msg: msg}
}

type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
