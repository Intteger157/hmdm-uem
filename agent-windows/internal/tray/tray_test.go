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

func TestBuildDeviceInformationURLFromRejectsLoopback(t *testing.T) {
	t.Parallel()

	cases := []string{
		"http://127.0.0.1:49152",
		"http://localhost:49152",
		"http://127.0.0.1:8080",
		"http://localhost:8080",
	}

	for _, serverURL := range cases {
		if _, err := buildDeviceInformationURLFrom(serverURL, "device-1"); err == nil {
			t.Fatalf("expected error for server URL %q", serverURL)
		}
	}
}
