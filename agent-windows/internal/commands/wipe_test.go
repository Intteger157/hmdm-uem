//go:build windows

package commands

import "testing"

func TestFactoryWipeScriptUsesMDMRemoteWipe(t *testing.T) {
	t.Parallel()

	if factoryWipeScript == "" {
		t.Fatal("expected non-empty factory wipe script")
	}
	for _, want := range []string{
		"root\\cimv2\\mdm\\dmmap",
		"MDM_RemoteWipe",
		"doWipeMethod",
	} {
		if !contains(factoryWipeScript, want) {
			t.Fatalf("factoryWipeScript = %q, missing %q", factoryWipeScript, want)
		}
	}
}

func TestFactoryWipeSuccessMessage(t *testing.T) {
	t.Parallel()

	want := "Factory wipe initiated. Device is rebooting to reset."
	if factoryWipeSuccessMessage != want {
		t.Fatalf("factoryWipeSuccessMessage = %q, want %q", factoryWipeSuccessMessage, want)
	}
}

func contains(value, part string) bool {
	return len(part) == 0 || (len(value) >= len(part) && indexOf(value, part) >= 0)
}

func indexOf(value, part string) int {
	for i := 0; i+len(part) <= len(value); i++ {
		if value[i:i+len(part)] == part {
			return i
		}
	}
	return -1
}

func TestExecuteWipeActionUsesFactoryWipe(t *testing.T) {
	t.Parallel()

	result := Execute("wipe", nil)
	if result.Message == "factory wipe is not implemented yet" {
		t.Fatal("Execute(wipe) still returns stub message")
	}
}
