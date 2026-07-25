package tray

import "testing"

func TestBuildDeviceInformationURLFrom(t *testing.T) {
	t.Parallel()

	got, err := buildDeviceInformationURLFrom("https://test-dev-mdm.intteger.uk", "HW-123/ABC")
	if err != nil {
		t.Fatalf("buildDeviceInformationURLFrom() error = %v", err)
	}
	want := "https://test-dev-mdm.intteger.uk/device-info/HW-123%2FABC"
	if got != want {
		t.Fatalf("buildDeviceInformationURLFrom() = %q, want %q", got, want)
	}
}

func TestBuildDeviceInformationURLFromRequiresValues(t *testing.T) {
	t.Parallel()

	if _, err := buildDeviceInformationURLFrom("", "device"); err == nil {
		t.Fatal("expected error for empty server URL")
	}
	if _, err := buildDeviceInformationURLFrom("https://mdm.example.com", ""); err == nil {
		t.Fatal("expected error for empty device id")
	}
}
