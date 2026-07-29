//go:build windows

package commands

import "testing"

func TestBuildTaskManagerWebSocketURL(t *testing.T) {
	got, err := buildTaskManagerWebSocketURL(
		"https://mdm.example.com",
		"/api/taskmgr/agent",
		"device-1",
	)
	if err != nil {
		t.Fatalf("buildTaskManagerWebSocketURL: %v", err)
	}
	want := "wss://mdm.example.com/api/taskmgr/agent?deviceID=device-1"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestResolveTaskManagerWebSocketURLUsesDeviceIDFallback(t *testing.T) {
	got, err := resolveTaskManagerWebSocketURL(
		"https://mdm.example.com",
		[]byte(`{"deviceID":"fallback-id"}`),
	)
	if err != nil {
		t.Fatalf("resolveTaskManagerWebSocketURL: %v", err)
	}
	want := "wss://mdm.example.com/api/taskmgr/agent?deviceID=fallback-id"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
