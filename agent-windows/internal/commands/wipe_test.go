//go:build windows

package commands

import "testing"

func TestFactoryResetCommandUsesSystemReset(t *testing.T) {
	t.Parallel()

	cmd := newFactoryResetCommand()
	if cmd.Path == "" {
		t.Fatal("expected factory reset command path")
	}
	if len(cmd.Args) < 2 || cmd.Args[len(cmd.Args)-1] != factoryResetArgFactory {
		t.Fatalf("factory reset args = %#v", cmd.Args)
	}
}

func TestFactoryWipeSuccessMessage(t *testing.T) {
	t.Parallel()

	want := "Factory reset initiated via systemreset.exe"
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

func TestExecuteWipeActionUsesFactoryReset(t *testing.T) {
	t.Parallel()

	originalStart := startFactoryReset
	startFactoryReset = func() error { return nil }
	t.Cleanup(func() {
		startFactoryReset = originalStart
		SetAfterFactoryResetStarted(nil)
	})

	SetAfterFactoryResetStarted(nil)
	result := Execute("wipe", nil)
	if !result.Success || result.Message != factoryWipeSuccessMessage {
		t.Fatalf("unexpected wipe result: success=%v message=%q", result.Success, result.Message)
	}
}
