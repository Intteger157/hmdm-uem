//go:build windows

package commands

import "testing"

func TestExecuteDeviceCommandApplyConfiguration(t *testing.T) {
	SetApplyConfigurationHandler(nil)
	result := ExecuteDeviceCommand("apply_configuration", "")
	if result.Success {
		t.Fatal("expected failure when apply configuration handler is not configured")
	}

	called := false
	SetApplyConfigurationHandler(func() {
		called = true
	})
	result = ExecuteDeviceCommand("apply_configuration", "")
	if !result.Success || result.Message != "configuration apply started" {
		t.Fatalf("unexpected result: success=%v message=%q", result.Success, result.Message)
	}
	if !called {
		t.Fatal("expected apply configuration handler to be invoked")
	}
}
