package handlers

import (
	"strings"
	"testing"
)

func TestWindowsDeviceSearchArgCount(t *testing.T) {
	if got := windowsDeviceSearchArgCount(); got != 8 {
		t.Fatalf("windowsDeviceSearchArgCount() = %d, want 8", got)
	}
}

func TestWindowsDeviceSearchColumnsIncludesCurrentUser(t *testing.T) {
	if !strings.Contains(windowsDeviceSearchColumns, `"current_user" ILIKE`) {
		t.Fatalf("search columns missing quoted current_user: %q", windowsDeviceSearchColumns)
	}
	if !strings.Contains(windowsDeviceSearchColumns, "hostname ILIKE") {
		t.Fatalf("search columns missing hostname: %q", windowsDeviceSearchColumns)
	}
}
