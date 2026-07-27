//go:build windows

package commands

import (
	"strings"
	"testing"
)

func TestFactoryWipeScriptUsesMDMRemoteWipe(t *testing.T) {
	t.Parallel()

	script := buildFactoryWipeScript()
	if !strings.Contains(script, "Invoke-CimMethod") {
		t.Fatalf("script = %q, expected Invoke-CimMethod", script)
	}
	if !strings.Contains(script, "ROOT\\CIMv2\\mdm\\dmmap") {
		t.Fatalf("script = %q, expected MDM WMI namespace", script)
	}
	if !strings.Contains(script, "MDM_RemoteWipe") || !strings.Contains(script, "doWipeMethod") {
		t.Fatalf("script = %q, expected MDM_RemoteWipe doWipeMethod", script)
	}
	if !strings.Contains(script, factoryWipeInitiatedOutput) {
		t.Fatalf("script = %q, expected wipe initiated marker", script)
	}
}

func TestFactoryWipeSuccessMessage(t *testing.T) {
	t.Parallel()

	want := "Factory reset initiated via MDM_RemoteWipe"
	if factoryWipeSuccessMessage != want {
		t.Fatalf("factoryWipeSuccessMessage = %q, want %q", factoryWipeSuccessMessage, want)
	}
}

func TestRunAfterFactoryResetStarted(t *testing.T) {
	t.Parallel()

	called := false
	SetAfterFactoryResetStarted(func() {
		called = true
	})
	t.Cleanup(func() {
		SetAfterFactoryResetStarted(nil)
	})

	runAfterFactoryResetStarted()
	if !called {
		t.Fatal("expected after factory reset callback to run")
	}
}

func TestExecuteDeviceCommandWipe(t *testing.T) {
	originalStart := startFactoryReset
	startFactoryReset = func() error { return nil }
	t.Cleanup(func() {
		startFactoryReset = originalStart
		SetAfterFactoryResetStarted(nil)
	})

	SetAfterFactoryResetStarted(nil)

	for _, commandName := range []string{"wipe", "factory_reset"} {
		t.Run(commandName, func(t *testing.T) {
			result := ExecuteDeviceCommand(commandName, "")
			if !result.Success || result.Message != factoryWipeSuccessMessage {
				t.Fatalf("unexpected wipe result: success=%v message=%q", result.Success, result.Message)
			}
		})
	}
}

func TestExecuteWipeActionUsesFactoryReset(t *testing.T) {
	originalStart := startFactoryReset
	startFactoryReset = func() error { return nil }
	t.Cleanup(func() {
		startFactoryReset = originalStart
		SetAfterFactoryResetStarted(nil)
	})

	SetAfterFactoryResetStarted(nil)
	for _, action := range []string{"wipe", "factory_reset"} {
		t.Run(action, func(t *testing.T) {
			result := Execute(action, nil)
			if !result.Success || result.Message != factoryWipeSuccessMessage {
				t.Fatalf("unexpected wipe result: success=%v message=%q", result.Success, result.Message)
			}
		})
	}
}
