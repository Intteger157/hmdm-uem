package models

import (
	"testing"
	"time"
)

func TestWindowsDeviceEnrollTimeMs(t *testing.T) {
	createdAt := time.Date(2026, 8, 11, 0, 15, 2, 0, time.UTC)
	device := WindowsDevice{CreatedAt: createdAt}

	got := windowsDeviceEnrollTimeMs(device)
	if got == nil {
		t.Fatal("expected enroll time")
	}
	if *got != createdAt.UnixMilli() {
		t.Fatalf("unexpected enroll time ms: got %d want %d", *got, createdAt.UnixMilli())
	}
}

func TestWindowsDeviceEnrollTimeMsZeroCreatedAt(t *testing.T) {
	if got := windowsDeviceEnrollTimeMs(WindowsDevice{}); got != nil {
		t.Fatalf("expected nil enroll time for zero CreatedAt, got %d", *got)
	}
}

func TestToWindowsDeviceJSONIncludesEnrollTime(t *testing.T) {
	createdAt := time.Date(2026, 8, 11, 0, 15, 2, 0, time.UTC)
	item := ToWindowsDeviceJSON(WindowsDevice{
		ID:         1,
		HardwareID: "hw-1",
		CreatedAt:  createdAt,
	})

	if item.EnrollTime == nil {
		t.Fatal("expected enrollTime in JSON payload")
	}
	if *item.EnrollTime != createdAt.UnixMilli() {
		t.Fatalf("unexpected enrollTime: got %d want %d", *item.EnrollTime, createdAt.UnixMilli())
	}
}
