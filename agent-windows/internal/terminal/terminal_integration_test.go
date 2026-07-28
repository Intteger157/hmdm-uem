//go:build windows

package terminal

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// startTestServer upgrades incoming requests to WebSocket and hands the
// connection to handle. It returns the ws:// URL of the test server.
func startTestServer(t *testing.T, handle func(conn *websocket.Conn)) string {
	t.Helper()
	upgrader := websocket.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			t.Errorf("upgrade: %v", err)
			return
		}
		handle(conn)
	}))
	t.Cleanup(server.Close)
	return "ws" + strings.TrimPrefix(server.URL, "http")
}

// TestLiveTerminalBridgesStdinToStdout drives a real PowerShell session: the
// server writes a command over the socket and expects the echoed output back,
// then sends `exit` so the process terminates and the session ends cleanly.
func TestLiveTerminalBridgesStdinToStdout(t *testing.T) {
	const marker = "LIVE_TERMINAL_PONG"
	received := make(chan string, 1)

	wsURL := startTestServer(t, func(conn *websocket.Conn) {
		defer conn.Close()
		if err := conn.WriteMessage(websocket.TextMessage, []byte("Write-Output '"+marker+"'\r\n")); err != nil {
			t.Errorf("write command: %v", err)
			return
		}

		var builder strings.Builder
		_ = conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			builder.Write(data)
			if strings.Contains(builder.String(), marker) {
				select {
				case received <- builder.String():
				default:
				}
				_ = conn.WriteMessage(websocket.TextMessage, []byte("exit\r\n"))
			}
		}
	})

	done := make(chan error, 1)
	go func() { done <- StartLiveTerminal(wsURL, "test-token") }()

	select {
	case out := <-received:
		if !strings.Contains(out, marker) {
			t.Fatalf("output %q missing marker %q", out, marker)
		}
	case <-time.After(30 * time.Second):
		t.Fatal("timed out waiting for PowerShell output")
	}

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("StartLiveTerminal did not return after PowerShell exit")
	}
}

// TestLiveTerminalStopsWhenSocketCloses verifies the session tears down (and the
// process is killed) when the server drops the connection.
func TestLiveTerminalStopsWhenSocketCloses(t *testing.T) {
	wsURL := startTestServer(t, func(conn *websocket.Conn) {
		time.Sleep(500 * time.Millisecond)
		_ = conn.Close()
	})

	done := make(chan error, 1)
	go func() { done <- StartLiveTerminal(wsURL, "") }()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		t.Fatal("StartLiveTerminal did not return after socket close")
	}
}
