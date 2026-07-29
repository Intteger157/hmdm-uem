//go:build windows

package commands

import "testing"

func TestBuildFileExplorerWebSocketURL(t *testing.T) {
	got, err := buildFileExplorerWebSocketURL(
		"https://mdm.example.com",
		"/api/filexplorer/agent",
		"device-1",
	)
	if err != nil {
		t.Fatalf("buildFileExplorerWebSocketURL: %v", err)
	}
	want := "wss://mdm.example.com/api/filexplorer/agent?deviceID=device-1"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveFileExplorerWebSocketURLUsesDeviceIDFallback(t *testing.T) {
	got, err := resolveFileExplorerWebSocketURL(
		"https://mdm.example.com",
		[]byte(`{"deviceID":"fallback-id"}`),
	)
	if err != nil {
		t.Fatalf("resolveFileExplorerWebSocketURL: %v", err)
	}
	want := "wss://mdm.example.com/api/filexplorer/agent?deviceID=fallback-id"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
