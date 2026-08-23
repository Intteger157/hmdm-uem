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
	// agentTerminalPath is the WebSocket endpoint the agent dials to join a session.
	agentTerminalPath = "/api/terminal/client"
	// agentJoinTimeout bounds how long the admin waits for the agent socket.
	agentJoinTimeout = 60 * time.Second
)

// terminalSession bridges an admin browser socket and a managed device socket
// for a single live terminal session.
type terminalSession struct {
	sessionID string

	AdminConn  *websocket.Conn
	AgentConn  *websocket.Conn

	ready      chan struct{}
	bridgeOnce sync.Once
	closeOnce  sync.Once
	done       chan struct{}

	agentAttachOnce sync.Once
}

// terminalRelay is a thread-safe registry of active terminal sessions keyed by sessionID.
type terminalRelay struct {
	sessions sync.Map // sessionID(string) -> *terminalSession
	upgrader websocket.Upgrader
}

func newTerminalRelay() *terminalRelay {
	return &terminalRelay{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin:     func(*http.Request) bool { return true },
		},
	}
}

func (s *terminalSession) attachAgent(conn *websocket.Conn) bool {
	attached := false
	s.agentAttachOnce.Do(func() {
		s.AgentConn = conn
		attached = true
		close(s.ready)
	})
	return attached
}

func (s *terminalSession) bothConnected() bool {
	return s.AdminConn != nil && s.AgentConn != nil
}

func (s *terminalSession) tryStartBridge(relay *terminalRelay) {
	if !s.bothConnected() {
		return
	}
	s.bridgeOnce.Do(func() {
		go relay.bridge(s)
	})
}

// teardown closes both sockets, removes the session from the registry, and unblocks
// handlers waiting on done.
func (s *terminalSession) teardown(relay *terminalRelay) {
	s.closeOnce.Do(func() {
		if s.AdminConn != nil {
			_ = s.AdminConn.Close()
		}
		if s.AgentConn != nil {
			_ = s.AgentConn.Close()
		}
		relay.sessions.Delete(s.sessionID)
		close(s.done)
	})
}

// HandleAdminTerminal upgrades the admin browser connection, registers the
// session, notifies the agent to connect, and relays traffic once both sides
// are present.
func (h *WindowsHandler) HandleAdminTerminal(c *gin.Context) {
	relay := h.terminalRelay
	sessionID := resolveTerminalSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionID"})
		return
	}

	session := &terminalSession{
		sessionID: sessionID,
		ready:     make(chan struct{}),
		done:      make(chan struct{}),
	}
	if _, loaded := relay.sessions.LoadOrStore(sessionID, session); loaded {
		c.JSON(http.StatusConflict, gin.H{"error": "a terminal session is already active for this device"})
		return
	}

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		relay.sessions.Delete(sessionID)
		log.Printf("[terminal] admin upgrade failed: session=%q err=%v", sessionID, err)
		return
	}
	session.AdminConn = conn

	enqueueAgentTerminalConnect(sessionID)

	select {
	case <-session.ready:
		log.Printf("[terminal] admin waiting for relay: session=%q", sessionID)
		<-session.done
	case <-time.After(agentJoinTimeout):
		log.Printf("[terminal] agent never joined: session=%q", sessionID)
		_ = conn.WriteMessage(
			websocket.TextMessage,
			[]byte("\r\nAgent did not connect. The device may be offline.\r\n"),
		)
		session.teardown(relay)
	}
}

// HandleAgentTerminal upgrades the agent connection, attaches it to the waiting
// admin session, and keeps the handler alive until the relay ends.
func (h *WindowsHandler) HandleAgentTerminal(c *gin.Context) {
	relay := h.terminalRelay
	sessionID := resolveTerminalSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing sessionID"})
		return
	}

	value, ok := relay.sessions.Load(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "no pending terminal session for this device"})
		return
	}
	session := value.(*terminalSession)

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[terminal] agent upgrade failed: session=%q err=%v", sessionID, err)
		session.teardown(relay)
		return
	}

	if !session.attachAgent(conn) {
		_ = conn.Close()
		return
	}

	log.Printf("[terminal] agent joined: session=%q", sessionID)
	session.tryStartBridge(relay)
	<-session.done
}

func (relay *terminalRelay) bridge(session *terminalSession) {
	log.Printf("[terminal] session bridged: session=%q", session.sessionID)

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		relay.pump(session, session.AdminConn, session.AgentConn)
	}()
	go func() {
		defer wg.Done()
		relay.pump(session, session.AgentConn, session.AdminConn)
	}()

	wg.Wait()
}

func (relay *terminalRelay) pump(session *terminalSession, src, dst *websocket.Conn) {
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

func resolveTerminalSessionID(c *gin.Context) string {
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

func enqueueAgentTerminalConnect(sessionID string) {
	if db.DB == nil {
		log.Printf("[terminal] skip agent connect enqueue (no DB): session=%q", sessionID)
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"sessionID": sessionID,
		"deviceID":  sessionID,
		"path":      agentTerminalPath,
	})

	command := models.WindowsDeviceCommand{
		HardwareID: sessionID,
		Action:     models.CommandNameRemoteSupport,
		Payload:    payload,
		Status:     models.CommandStatusPending,
	}
	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[terminal] agent connect enqueue failed: session=%q err=%v", sessionID, err)
		return
	}
	log.Printf("[terminal] agent connect command queued: session=%q id=%d", sessionID, command.ID)
}
