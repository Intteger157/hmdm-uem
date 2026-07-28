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

func TestResolveSupportChatSessionIDPrefersSessionIDQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/?sessionID=session-1&deviceID=device-2", nil)
	ctx.Params = gin.Params{{Key: "hardwareId", Value: "device-3"}}
	ctx.Request.Header.Set("X-Device-Id", "device-4")

	if got := resolveSupportChatSessionID(ctx); got != "session-1" {
		t.Fatalf("sessionID = %q, want session-1", got)
	}
}

func TestSupportChatRelayBridgesOperatorAndClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/operator", handler.HandleOperatorTerminal)
	router.GET("/client", handler.HandleClientTerminal)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	sessionID := "device-bridge-test"
	received := make(chan string, 1)

	var operatorWG sync.WaitGroup
	operatorWG.Add(1)
	go func() {
		defer operatorWG.Done()
		operatorConn, _, err := websocket.DefaultDialer.Dial(
			baseURL+"/operator?sessionID="+sessionID,
			nil,
		)
		if err != nil {
			t.Errorf("dial operator: %v", err)
			return
		}
		defer operatorConn.Close()

		_, data, err := operatorConn.ReadMessage()
		if err != nil {
			t.Errorf("operator read: %v", err)
			return
		}
		select {
		case received <- string(data):
		default:
		}
	}()

	time.Sleep(100 * time.Millisecond)

	clientConn, _, err := websocket.DefaultDialer.Dial(
		baseURL+"/client?sessionID="+sessionID,
		http.Header{
			"Authorization": []string{"Bearer mock-jwt-token-777"},
			"X-Device-Id":   []string{sessionID},
		},
	)
	if err != nil {
		t.Fatalf("dial client: %v", err)
	}
	defer clientConn.Close()

	if err := clientConn.WriteMessage(websocket.TextMessage, []byte("hello-operator")); err != nil {
		t.Fatalf("client write: %v", err)
	}

	select {
	case msg := <-received:
		if msg != "hello-operator" {
			t.Fatalf("operator received %q, want hello-operator", msg)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for bridged message")
	}

	_ = clientConn.Close()
	operatorWG.Wait()
	time.Sleep(100 * time.Millisecond)

	if _, ok := handler.supportChatRelay.sessions.Load(sessionID); ok {
		t.Fatal("session should be removed from registry after disconnect")
	}
}

func TestSupportChatClientRequiresPendingSession(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/client", handler.HandleClientTerminal)

	server := httptest.NewServer(router)
	defer server.Close()

	baseURL := "ws" + strings.TrimPrefix(server.URL, "http")
	_, response, err := websocket.DefaultDialer.Dial(
		baseURL+"/client?sessionID=missing-session",
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
