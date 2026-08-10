package handlers

import (
	"fmt"
	"testing"
)

func TestNormalizeDeviceGroupDeviceIDs(t *testing.T) {
	got := normalizeDeviceGroupDeviceIDs([]uint{0, 3, 3, 7, 0})
	if len(got) != 2 || got[0] != 3 || got[1] != 7 {
		t.Fatalf("normalizeDeviceGroupDeviceIDs() = %v, want [3 7]", got)
	}
}

func TestMapGroupAssignmentError(t *testing.T) {
	status, message := mapGroupAssignmentError(nil)
	if status != 0 || message != "" {
		t.Fatalf("nil error should return empty")
	}

	status, message = mapGroupAssignmentError(fmt.Errorf("configuration profile not found"))
	if status != 400 || message != "configuration profile not found" {
		t.Fatalf("mapGroupAssignmentError() = (%d, %q)", status, message)
	}
}
