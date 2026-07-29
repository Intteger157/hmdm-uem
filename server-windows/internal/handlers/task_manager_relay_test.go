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

func TestResolveTaskManagerSessionIDPrefersDeviceIDQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/?sessionID=session-1&deviceID=device-2", nil)
	ctx.Params = gin.Params{{Key: "hardwareId", Value: "device-3"}}
	ctx.Request.Header.Set("X-Device-Id", "device-4")

	if got := resolveTaskManagerSessionID(ctx); got != "session-1" {
		t.Fatalf("sessionID = %q, want session-1", got)
	}
}

func TestTaskManagerRelayBridgesAdminAndAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/admin", handler.HandleAdminTaskManager)
	router.GET("/agent", handler.HandleAgentTaskManager)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	sessionID := "device-taskmgr-bridge"
	received := make(chan string, 1)

	var adminWG sync.WaitGroup
	adminWG.Add(1)
	go func() {
		defer adminWG.Done()
		adminConn, _, err := websocket.DefaultDialer.Dial(
			baseURL+"/admin?deviceID="+sessionID,
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
		baseURL+"/agent?deviceID="+sessionID,
		http.Header{
			"Authorization": []string{"Bearer mock-jwt-token-777"},
			"X-Device-Id":   []string{sessionID},
		},
	)
	if err != nil {
		t.Fatalf("dial agent: %v", err)
	}
	defer agentConn.Close()

	payload := `{"type":"process_list","processes":[{"pid":123,"name":"powershell.exe"}]}`
	if err := agentConn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
		t.Fatalf("agent write: %v", err)
	}

	select {
	case msg := <-received:
		if msg != payload {
			t.Fatalf("admin received %q, want %q", msg, payload)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for bridged JSON message")
	}

	_ = agentConn.Close()
	adminWG.Wait()
	time.Sleep(100 * time.Millisecond)

	if _, ok := handler.taskManagerRelay.sessions.Load(sessionID); ok {
		t.Fatal("session should be removed from registry after disconnect")
	}
}

func TestTaskManagerRelayIgnoresBinaryMessages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/admin", handler.HandleAdminTaskManager)
	router.GET("/agent", handler.HandleAgentTaskManager)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	sessionID := "device-taskmgr-binary-filter"

	adminConn, _, err := websocket.DefaultDialer.Dial(
		baseURL+"/admin?deviceID="+sessionID,
		nil,
	)
	if err != nil {
		t.Fatalf("dial admin: %v", err)
	}
	defer adminConn.Close()

	time.Sleep(100 * time.Millisecond)

	agentConn, _, err := websocket.DefaultDialer.Dial(
		baseURL+"/agent?deviceID="+sessionID,
		http.Header{
			"Authorization": []string{"Bearer mock-jwt-token-777"},
			"X-Device-Id":   []string{sessionID},
		},
	)
	if err != nil {
		t.Fatalf("dial agent: %v", err)
	}
	defer agentConn.Close()

	if err := agentConn.WriteMessage(websocket.BinaryMessage, []byte("ignored")); err != nil {
		t.Fatalf("agent binary write: %v", err)
	}

	jsonPayload := `{"type":"ping"}`
	if err := agentConn.WriteMessage(websocket.TextMessage, []byte(jsonPayload)); err != nil {
		t.Fatalf("agent text write: %v", err)
	}

	adminConn.SetReadDeadline(time.Now().Add(5 * time.Second))
	_, data, err := adminConn.ReadMessage()
	if err != nil {
		t.Fatalf("admin read: %v", err)
	}
	if string(data) != jsonPayload {
		t.Fatalf("admin received %q, want %q", string(data), jsonPayload)
	}
}

func TestTaskManagerAgentRequiresPendingSession(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/agent", handler.HandleAgentTaskManager)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	_, response, err := websocket.DefaultDialer.Dial(
		baseURL+"/agent?deviceID=missing-session",
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
