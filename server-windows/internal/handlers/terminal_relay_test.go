package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestResolveTerminalSessionIDPrefersSessionIDQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/?sessionID=session-1&deviceID=device-2", nil)
	ctx.Params = gin.Params{{Key: "hardwareId", Value: "device-3"}}
	ctx.Request.Header.Set("X-Device-Id", "device-4")

	if got := resolveTerminalSessionID(ctx); got != "session-1" {
		t.Fatalf("sessionID = %q, want session-1", got)
	}
}

func TestTerminalRelayBridgesAdminAndAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/admin", handler.HandleAdminTerminal)
	router.GET("/agent", handler.HandleAgentTerminal)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	sessionID := "device-bridge-test"
	received := make(chan string, 1)

	var adminWG sync.WaitGroup
	adminWG.Add(1)
	go func() {
		defer adminWG.Done()
		adminConn, _, err := websocket.DefaultDialer.Dial(
			baseURL+"/admin?sessionID="+sessionID,
			nil,
		)
		if err != nil {
			t.Errorf("dial admin: %v", err)
			return
		}
		defer adminConn.Close()

		_, data, err := adminConn.ReadMessage()
		if err != nil {
			t.Errorf("admin read: %v", err)
			return
		}
		select {
		case received <- string(data):
		default:
		}
	}()

	time.Sleep(100 * time.Millisecond)

	agentConn, _, err := websocket.DefaultDialer.Dial(
		baseURL+"/agent?sessionID="+sessionID,
		http.Header{
			"Authorization": []string{"Bearer mock-jwt-token-777"},
			"X-Device-Id":   []string{sessionID},
		},
	)
	if err != nil {
		t.Fatalf("dial agent: %v", err)
	}
	defer agentConn.Close()

	if err := agentConn.WriteMessage(websocket.TextMessage, []byte("hello-admin")); err != nil {
		t.Fatalf("agent write: %v", err)
	}

	select {
	case msg := <-received:
		if msg != "hello-admin" {
			t.Fatalf("admin received %q, want hello-admin", msg)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for bridged message")
	}

	_ = agentConn.Close()
	adminWG.Wait()
	time.Sleep(100 * time.Millisecond)

	if _, ok := handler.terminalRelay.sessions.Load(sessionID); ok {
		t.Fatal("session should be removed from registry after disconnect")
	}
}

func TestTerminalAgentRequiresPendingSession(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/agent", handler.HandleAgentTerminal)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	_, response, err := websocket.DefaultDialer.Dial(
		baseURL+"/agent?sessionID=missing-session",
		http.Header{
			"Authorization": []string{"Bearer mock-jwt-token-777"},
			"X-Device-Id":   []string{"missing-session"},
		},
	)
	if err == nil {
		t.Fatal("expected dial failure for missing session")
	}
	if response == nil || response.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %v, want 404", response)
	}
}
