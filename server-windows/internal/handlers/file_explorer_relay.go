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
	// agentFileExplorerPath is the WebSocket endpoint the agent dials to join a session.
	agentFileExplorerPath = "/api/filexplorer/agent"
	// agentFileExplorerJoinTimeout bounds how long the admin waits for the agent socket.
	agentFileExplorerJoinTimeout = 60 * time.Second
)

// fileExplorerSession bridges an admin browser socket and a managed device socket
// for a single interactive file explorer session.
type fileExplorerSession struct {
	sessionID string

	AdminConn *websocket.Conn
	AgentConn *websocket.Conn

	ready      chan struct{}
	bridgeOnce sync.Once
	closeOnce  sync.Once
	done       chan struct{}

	agentAttachOnce sync.Once
}

// fileExplorerRelay is a thread-safe registry of active file explorer sessions keyed by sessionID.
type fileExplorerRelay struct {
	sessions sync.Map // sessionID(string) -> *fileExplorerSession
	upgrader websocket.Upgrader
}

func newFileExplorerRelay() *fileExplorerRelay {
	return &fileExplorerRelay{
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin:     func(*http.Request) bool { return true },
		},
	}
}

func (s *fileExplorerSession) attachAgent(conn *websocket.Conn) bool {
	attached := false
	s.agentAttachOnce.Do(func() {
		s.AgentConn = conn
		attached = true
		close(s.ready)
	})
	return attached
}

func (s *fileExplorerSession) bothConnected() bool {
	return s.AdminConn != nil && s.AgentConn != nil
}

func (s *fileExplorerSession) tryStartBridge(relay *fileExplorerRelay) {
	if !s.bothConnected() {
		return
	}
	s.bridgeOnce.Do(func() {
		go relay.bridge(s)
	})
}

// teardown closes both sockets, removes the session from the registry, and unblocks
// handlers waiting on done.
func (s *fileExplorerSession) teardown(relay *fileExplorerRelay) {
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

// HandleAdminFileExplorer upgrades the admin browser connection, registers the
// session, notifies the agent to connect, and relays JSON and binary traffic once
// both sides are present.
func (h *WindowsHandler) HandleAdminFileExplorer(c *gin.Context) {
	relay := h.fileExplorerRelay
	sessionID := resolveFileExplorerSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing deviceID"})
		return
	}

	session := &fileExplorerSession{
		sessionID: sessionID,
		ready:     make(chan struct{}),
		done:      make(chan struct{}),
	}
	if _, loaded := relay.sessions.LoadOrStore(sessionID, session); loaded {
		c.JSON(http.StatusConflict, gin.H{"error": "a file explorer session is already active for this device"})
		return
	}

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		relay.sessions.Delete(sessionID)
		log.Printf("[filexplorer] admin upgrade failed: session=%q err=%v", sessionID, err)
		return
	}
	session.AdminConn = conn

	enqueueAgentFileExplorerConnect(sessionID)

	select {
	case <-session.ready:
		log.Printf("[filexplorer] admin waiting for relay: session=%q", sessionID)
		<-session.done
	case <-time.After(agentFileExplorerJoinTimeout):
		log.Printf("[filexplorer] agent never joined: session=%q", sessionID)
		_ = conn.WriteMessage(
			websocket.TextMessage,
			[]byte(`{"type":"error","message":"Agent did not connect. The device may be offline."}`),
		)
		session.teardown(relay)
	}
}

// HandleAgentFileExplorer upgrades the agent connection, attaches it to the waiting
// admin session, and keeps the handler alive until the relay ends.
func (h *WindowsHandler) HandleAgentFileExplorer(c *gin.Context) {
	if !validateAgentAuth(c) {
		return
	}

	relay := h.fileExplorerRelay
	sessionID := resolveFileExplorerSessionID(c)
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing deviceID"})
		return
	}

	value, ok := relay.sessions.Load(sessionID)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "no pending file explorer session for this device"})
		return
	}
	session := value.(*fileExplorerSession)

	conn, err := relay.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[filexplorer] agent upgrade failed: session=%q err=%v", sessionID, err)
		session.teardown(relay)
		return
	}

	if !session.attachAgent(conn) {
		_ = conn.Close()
		return
	}

	log.Printf("[filexplorer] agent joined: session=%q", sessionID)
	session.tryStartBridge(relay)
	<-session.done
}

func (relay *fileExplorerRelay) bridge(session *fileExplorerSession) {
	log.Printf("[filexplorer] session bridged: session=%q", session.sessionID)

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

func (relay *fileExplorerRelay) pump(session *fileExplorerSession, src, dst *websocket.Conn) {
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

func resolveFileExplorerSessionID(c *gin.Context) string {
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

func enqueueAgentFileExplorerConnect(sessionID string) {
	if db.DB == nil {
		log.Printf("[filexplorer] skip agent connect enqueue (no DB): session=%q", sessionID)
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"sessionID": sessionID,
		"deviceID":  sessionID,
		"path":      agentFileExplorerPath,
	})

	command := models.WindowsDeviceCommand{
		HardwareID: sessionID,
		Action:     models.CommandNameStartFileExplorer,
		Payload:    payload,
		Status:     models.CommandStatusPending,
	}
	if err := db.DB.Create(&command).Error; err != nil {
		log.Printf("[filexplorer] agent connect enqueue failed: session=%q err=%v", sessionID, err)
		return
	}
	log.Printf("[filexplorer] agent connect command queued: session=%q id=%d", sessionID, command.ID)
}
