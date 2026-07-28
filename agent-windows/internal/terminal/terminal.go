//go:build windows

// Package terminal implements a reverse WebSocket shell: the agent dials the
// MDM server, spawns an interactive PowerShell process, and bridges the socket
// to the process stdin/stdout/stderr so an operator can drive a live session.
package terminal

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/UserExistsError/conpty"
	"github.com/gorilla/websocket"
	"github.com/hmdm/agent-windows/internal/procexec"
)

// streamBufferSize is the read chunk size for the process output pumps.
const streamBufferSize = 4096

// dialTimeout bounds how long the initial WebSocket handshake may take.
const dialTimeout = 15 * time.Second

const powershellCommandLine = `powershell.exe -NoProfile -NoLogo`

const defaultTerminalCols = 120
const defaultTerminalRows = 30

// buildDialHeader assembles the handshake headers, carrying the auth token as a
// bearer credential when one is supplied.
func buildDialHeader(token, hardwareID string) http.Header {
	header := http.Header{}
	if trimmed := strings.TrimSpace(token); trimmed != "" {
		header.Set("Authorization", "Bearer "+trimmed)
	}
	if trimmed := strings.TrimSpace(hardwareID); trimmed != "" {
		header.Set("X-Device-Id", trimmed)
	}
	return header
}

// StartLiveTerminal dials wsURL, launches an interactive PowerShell process, and
// pumps data between the socket and the process until either side closes. It
// blocks until the session ends and always tears down both the process and the
// socket before returning.
func StartLiveTerminal(wsURL, token, hardwareID string) error {
	dialer := websocket.Dialer{HandshakeTimeout: dialTimeout}
	conn, resp, err := dialer.Dial(wsURL, buildDialHeader(token, hardwareID))
	if err != nil {
		if resp != nil {
			return fmt.Errorf("live terminal dial (%s): %w", resp.Status, err)
		}
		return fmt.Errorf("live terminal dial: %w", err)
	}

	session := &liveTerminalSession{conn: conn, done: make(chan struct{})}
	return session.run()
}

// liveTerminalSession bridges a single WebSocket connection to a PowerShell ConPTY.
type liveTerminalSession struct {
	conn *websocket.Conn
	cpty *conpty.ConPty

	// writeMu serializes writes because gorilla/websocket forbids concurrent writers.
	writeMu sync.Mutex

	closeOnce sync.Once
	done      chan struct{}
}

func (s *liveTerminalSession) run() error {
	cpty, err := conpty.Start(
		powershellCommandLine,
		conpty.ConPtyDimensions(defaultTerminalCols, defaultTerminalRows),
	)
	if err != nil {
		s.closeConn()
		return fmt.Errorf("live terminal start conpty: %w", err)
	}
	s.cpty = cpty

	var pumps sync.WaitGroup

	// Goroutine 1: socket -> ConPTY stdin.
	pumps.Add(1)
	go func() {
		defer pumps.Done()
		s.pumpSocketToConPty(cpty)
	}()

	// Goroutine 2: ConPTY stdout/stderr -> socket.
	pumps.Add(1)
	go func() {
		defer pumps.Done()
		s.pumpConPtyToSocket(cpty)
	}()

	_, waitErr := cpty.Wait(context.Background())
	s.shutdown()

	pumps.Wait()

	if waitErr != nil {
		return fmt.Errorf("live terminal powershell exited: %w", waitErr)
	}
	return nil
}

// pumpSocketToConPty forwards operator keystrokes from the socket into the process.
func (s *liveTerminalSession) pumpSocketToConPty(cpty *conpty.ConPty) {
	for {
		messageType, data, err := s.conn.ReadMessage()
		if err != nil {
			s.killProcess()
			return
		}
		if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
			continue
		}
		if messageType == websocket.TextMessage && tryHandleControlMessage(cpty, data) {
			continue
		}
		data = normalizeTerminalInput(data)
		if _, err := cpty.Write(data); err != nil {
			s.killProcess()
			return
		}
	}
}

// pumpConPtyToSocket streams process output to the socket until EOF or error.
func (s *liveTerminalSession) pumpConPtyToSocket(reader io.Reader) {
	buffer := make([]byte, streamBufferSize)
	for {
		n, readErr := reader.Read(buffer)
		if n > 0 {
			if err := s.writeMessage(buffer[:n]); err != nil {
				return
			}
		}
		if readErr != nil {
			return
		}
	}
}

func (s *liveTerminalSession) writeMessage(data []byte) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteMessage(websocket.BinaryMessage, data)
}

// shutdown attempts a graceful close handshake, then closes the socket once.
func (s *liveTerminalSession) shutdown() {
	s.closeOnce.Do(func() {
		close(s.done)
		s.writeMu.Lock()
		_ = s.conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
			time.Now().Add(time.Second),
		)
		s.writeMu.Unlock()
		_ = s.conn.Close()
	})
}

func (s *liveTerminalSession) closeConn() {
	s.closeOnce.Do(func() {
		close(s.done)
		_ = s.conn.Close()
	})
}

// killProcess forcefully terminates the PowerShell process tree if still running.
func (s *liveTerminalSession) killProcess() {
	if s.cpty == nil {
		return
	}
	if pid := s.cpty.Pid(); pid > 0 {
		if err := procexec.KillProcessTree(pid); err != nil {
			log.Printf("live terminal: kill powershell process tree: %v", err)
		}
	}
	if err := s.cpty.Close(); err != nil {
		log.Printf("live terminal: close conpty: %v", err)
	}
}
