package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

const (
	// clientTerminalPath is the WebSocket endpoint the desktop client dials to join.
	clientTerminalPath = "/api/terminal/client"
	// clientJoinTimeout bounds how long the operator waits for the client socket.
	clientJoinTimeout = 60 * time.Second
)

// supportChatSession holds the two sides of a 1-on-1 support chat relay.
type supportChatSession struct {
	sessionID string

	OperatorConn *websocket.Conn
	ClientConn   *websocket.Conn

	ready      chan struct{}
	bridgeOnce sync.Once
	closeOnce  sync.Once
	done       chan struct{}

	clientAttachOnce sync.Once
}

// supportChatRelay is a thread-safe registry of active chat sessions keyed by sessionID.
type supportChatRelay struct {
	sessions sync.Map // sessionID(string) -> *supportChatSession
	upgrader websocket.Upgrader
}

func newSupportChatRelay() *supportChatRelay {
	return &supportChatRelay{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin:     func(*http.Request) bool { return true },
		},
	}
}

func (s *supportChatSession) attachClient(conn *websocket.Conn) bool {
	attached := false
	s.clientAttachOnce.Do(func() {
		s.ClientConn = conn
		attached = true
		close(s.ready)
	})
	return attached
}

func (s *supportChatSession) bothConnected() bool {
	return s.OperatorConn != nil && s.ClientConn != nil
}

func (s *supportChatSession) tryStartBridge(relay *supportChatRelay) {
	if !s.bothConnected() {
		return
	}
	s.bridgeOnce.Do(func() {
		go relay.bridge(s)
	})
}

// teardown closes both sockets, removes the session from the registry, and unblocks
// handlers waiting on done.
func (s *supportChatSession) teardown(relay *supportChatRelay) {
	s.closeOnce.Do(func() {
		if s.OperatorConn != nil {
			_ = s.OperatorConn.Close()
		}
		if s.ClientConn != nil {
			_ = s.ClientConn.Close()
		}
		relay.sessions.Delete(s.sessionID)
		close(s.done)
	})
}

// HandleOperatorTerminal upgrades the operator browser connection, registers the
// session, notifies the desktop client to connect, and relays traffic once both
// sides are present.
func (h *WindowsHandler) HandleOperatorTerminal(c *gin.Context) {
	relay := h.supportChatRelay
	sessionID := resolveSupportChatSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionID"})
		return
	}

	session := &supportChatSession{
		sessionID: sessionID,
		ready:     make(chan struct{}),
		done:      make(chan struct{}),
	}
	if _, loaded := relay.sessions.LoadOrStore(sessionID, session); loaded {
		c.JSON(http.StatusConflict, gin.H{"error": "a support chat session is already active for this device"})
		return
	}

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		relay.sessions.Delete(sessionID)
		log.Printf("[support-chat] operator upgrade failed: session=%q err=%v", sessionID, err)
		return
	}
	session.OperatorConn = conn

	enqueueSupportChatClientConnect(sessionID)

	select {
	case <-session.ready:
		log.Printf("[support-chat] operator waiting for relay: session=%q", sessionID)
		<-session.done
	case <-time.After(clientJoinTimeout):
		log.Printf("[support-chat] client never joined: session=%q", sessionID)
		_ = conn.WriteMessage(
			websocket.TextMessage,
			[]byte("\r\nClient did not connect. The device may be offline.\r\n"),
		)
		session.teardown(relay)
	}
}

// HandleClientTerminal upgrades the desktop client connection, attaches it to the
// waiting operator session, and keeps the handler alive until the relay ends.
func (h *WindowsHandler) HandleClientTerminal(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	relay := h.supportChatRelay
	sessionID := resolveSupportChatSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionID"})
		return
	}

	value, ok := relay.sessions.Load(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "no pending support chat session for this device"})
		return
	}
	session := value.(*supportChatSession)

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[support-chat] client upgrade failed: session=%q err=%v", sessionID, err)
		session.teardown(relay)
		return
	}

	if !session.attachClient(conn) {
		_ = conn.Close()
		return
	}

	log.Printf("[support-chat] client joined: session=%q", sessionID)
	session.tryStartBridge(relay)
	<-session.done
}

// HandleAdminTerminal is kept for backward compatibility with the live terminal UI.
func (h *WindowsHandler) HandleAdminTerminal(c *gin.Context) {
	h.HandleOperatorTerminal(c)
}

// HandleAgentTerminal is kept for backward compatibility with older agent builds.
func (h *WindowsHandler) HandleAgentTerminal(c *gin.Context) {
	h.HandleClientTerminal(c)
}

func (relay *supportChatRelay) bridge(session *supportChatSession) {
	log.Printf("[support-chat] session bridged: session=%q", session.sessionID)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		relay.pump(session, session.OperatorConn, session.ClientConn)
	}()
	go func() {
		defer wg.Done()
		relay.pump(session, session.ClientConn, session.OperatorConn)
	}()

	wg.Wait()
}

func (relay *supportChatRelay) pump(session *supportChatSession, src, dst *websocket.Conn) {
	for {
		messageType, data, err := src.ReadMessage()
		if err != nil {
			session.teardown(relay)
			return
		}
		if err := dst.WriteMessage(messageType, data); err != nil {
			session.teardown(relay)
			return
		}
	}
}

func resolveSupportChatSessionID(c *gin.Context) string {
	if id := strings.TrimSpace(c.Query("sessionID")); id != "" {
		return id
	}
	if id := strings.TrimSpace(c.Query("deviceID")); id != "" {
		return id
	}
	if id := strings.TrimSpace(c.Param("hardwareId")); id != "" {
		return id
	}
	return strings.TrimSpace(c.GetHeader("X-Device-Id"))
}

func enqueueSupportChatClientConnect(sessionID string) {
	if db.DB == nil {
		log.Printf("[support-chat] skip client connect enqueue (no DB): session=%q", sessionID)
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"sessionID": sessionID,
		"deviceID":  sessionID,
		"path":      clientTerminalPath,
	})

	command := models.WindowsDeviceCommand{
		HardwareID: sessionID,
		Action:     models.CommandNameRemoteSupport,
		Payload:    payload,
		Status:     models.CommandStatusPending,
	}
	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[support-chat] client connect enqueue failed: session=%q err=%v", sessionID, err)
		return
	}
	log.Printf("[support-chat] client connect command queued: session=%q id=%d", sessionID, command.ID)
}
