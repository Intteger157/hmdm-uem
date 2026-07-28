//go:build windows

package commands

import "testing"

func TestBuildTerminalWebSocketURL(t *testing.T) {
	tests := []struct {
		name      string
		serverURL string
		path      string
		sessionID string
		want      string
		wantErr   bool
	}{
		{
			name:      "https default path",
			serverURL: "https://mdm.example.com",
			path:      "",
			sessionID: "HW-123",
			want:      "wss://mdm.example.com/api/terminal/client?sessionID=HW-123",
		},
		{
			name:      "http custom path",
			serverURL: "http://localhost:8080/",
			path:      "/api/terminal/client",
			sessionID: "dev-1",
			want:      "ws://localhost:8080/api/terminal/client?sessionID=dev-1",
		},
		{
			name:      "missing scheme",
			serverURL: "mdm.example.com",
			path:      defaultTerminalPath,
			sessionID: "x",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := buildTerminalWebSocketURL(tt.serverURL, tt.path, tt.sessionID)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("buildTerminalWebSocketURL: %v", err)
			}
			if got != tt.want {
				t.Fatalf("got %q want %q", got, tt.want)
			}
		})
	}
}

func TestResolveRemoteSupportWebSocketURL(t *testing.T) {
	got, err := resolveRemoteSupportWebSocketURL(
		"https://mdm.example.com",
		[]byte(`{"sessionID":"abc","path":"/api/terminal/client"}`),
	)
	if err != nil {
		t.Fatalf("resolveRemoteSupportWebSocketURL: %v", err)
	}
	want := "wss://mdm.example.com/api/terminal/client?sessionID=abc"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}

	got, err = resolveRemoteSupportWebSocketURL(
		"https://mdm.example.com",
		[]byte(`{"deviceID":"fallback-id"}`),
	)
	if err != nil {
		t.Fatalf("resolveRemoteSupportWebSocketURL deviceID fallback: %v", err)
	}
	want = "wss://mdm.example.com/api/terminal/client?sessionID=fallback-id"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
