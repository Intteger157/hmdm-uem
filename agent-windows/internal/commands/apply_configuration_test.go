//go:build windows

package commands

import (
	"strings"
	"testing"
)

func TestExecuteDeviceCommandApplyConfiguration(t *testing.T) {
	SetApplyConfigurationHandler(nil)
	result := ExecuteDeviceCommand("apply_configuration", "", nil)
	if result.Success {
		t.Fatal("expected failure when apply configuration handler is not configured")
	}

	SetApplyConfigurationHandler(func() (string, error) {
		return "", errApplyConfigurationFailed
	})
	result = ExecuteDeviceCommand("apply_configuration", "", nil)
	if result.Success || !strings.Contains(result.Message, "apply configuration failed") {
		t.Fatalf("unexpected result: success=%v message=%q", result.Success, result.Message)
	}

	called := false
	SetApplyConfigurationHandler(func() (string, error) {
		called = true
		return "=== Configuration Evaluation Report ===\n- App [Demo]: Queued for installation\n", nil
	})
	result = ExecuteDeviceCommand("apply_configuration", "", nil)
	if !result.Success || !strings.Contains(result.Message, "Configuration Evaluation Report") {
		t.Fatalf("unexpected result: success=%v message=%q", result.Success, result.Message)
	}
	if !called {
		t.Fatal("expected apply configuration handler to be invoked")
	}
}

var errApplyConfigurationFailed = applyConfigurationTestError("apply configuration failed")

type applyConfigurationTestError string

func (e applyConfigurationTestError) Error() string { return string(e) }
