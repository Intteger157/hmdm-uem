//go:build windows

package commands

import (
	"strings"
	"testing"
)

func TestFactoryWipeScriptUsesMDMRemoteWipe(t *testing.T) {
	t.Parallel()

	script := buildFactoryWipeScript()
	if !strings.Contains(script, "Get-CimInstance") {
		t.Fatalf("script = %q, expected Get-CimInstance", script)
	}
	if !strings.Contains(script, "Invoke-CimMethod -MethodName doWipeMethod -Arguments @{param=''}") {
		t.Fatalf("script = %q, expected empty param argument for MDM wipe method", script)
	}
	if !strings.Contains(script, "Get-CimInstance -Namespace ROOT\\CIMv2\\mdm\\dmmap -ClassName MDM_RemoteWipe | Invoke-CimMethod -MethodName doWipeMethod") {
		t.Fatalf("script = %q, expected instance method invocation via pipe", script)
	}
	if strings.Contains(script, "Invoke-CimMethod -Namespace") {
		t.Fatalf("script = %q, should not invoke static CIM method", script)
	}
	if !strings.Contains(script, factoryWipeSuccessMessage) {
		t.Fatalf("script = %q, expected wipe success marker", script)
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
			result := ExecuteDeviceCommand(commandName, "", nil)
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
			result := Execute(action, nil, nil)
			if !result.Success || result.Message != factoryWipeSuccessMessage {
				t.Fatalf("unexpected wipe result: success=%v message=%q", result.Success, result.Message)
			}
		})
	}
}
