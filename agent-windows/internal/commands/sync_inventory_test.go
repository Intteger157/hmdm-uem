//go:build windows

package commands

import (
	"errors"
	"testing"
)

func TestExecuteDeviceCommandSync(t *testing.T) {
	SetSyncInventoryHandler(nil)
	result := ExecuteDeviceCommand("sync", "", nil)
	if result.Success {
		t.Fatal("expected failure when sync handler is not configured")
	}

	SetSyncInventoryHandler(func() error {
		return errors.New("upload failed")
	})
	result = ExecuteDeviceCommand("sync", "", nil)
	if result.Success || result.Message != "upload failed" {
		t.Fatalf("unexpected result: success=%v message=%q", result.Success, result.Message)
	}

	SetSyncInventoryHandler(func() error {
		return nil
	})
	result = ExecuteDeviceCommand("sync", "", nil)
	if !result.Success || result.Message != "inventory uploaded" {
		t.Fatalf("unexpected result: success=%v message=%q", result.Success, result.Message)
	}
}
