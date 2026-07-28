//go:build windows

// Package terminal implements a reverse WebSocket shell: the agent dials the
// MDM server, spawns an interactive PowerShell process, and bridges the socket
// to the process stdin/stdout/stderr so an operator can drive a live session.
package terminal

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hmdm/agent-windows/internal/procexec"
)

// streamBufferSize is the read chunk size for the process output pumps.
const streamBufferSize = 4096

// dialTimeout bounds how long the initial WebSocket handshake may take.
const dialTimeout = 15 * time.Second

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

// liveTerminalSession bridges a single WebSocket connection to a PowerShell process.
type liveTerminalSession struct {
	conn *websocket.Conn
	cmd  *exec.Cmd

	// writeMu serializes writes because gorilla/websocket forbids concurrent
	// writers, and both the stdout and stderr pumps write to the same socket.
	writeMu sync.Mutex

	closeOnce sync.Once
	done      chan struct{}
}

func (s *liveTerminalSession) run() error {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NoLogo")
	procexec.ConfigureHiddenProcessGroup(cmd)
	s.cmd = cmd

	stdin, err := cmd.StdinPipe()
	if err != nil {
		s.closeConn()
		return fmt.Errorf("live terminal stdin pipe: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		s.closeConn()
		return fmt.Errorf("live terminal stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		s.closeConn()
		return fmt.Errorf("live terminal stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		s.closeConn()
		return fmt.Errorf("live terminal start powershell: %w", err)
	}

	var pumps sync.WaitGroup

	// Goroutine 1: socket -> process stdin.
	pumps.Add(1)
	go func() {
		defer pumps.Done()
		s.pumpSocketToStdin(stdin)
	}()

	// Goroutine 2 & 3: process stdout/stderr -> socket.
	pumps.Add(2)
	go func() {
		defer pumps.Done()
		s.pumpReaderToSocket(stdout)
	}()
	go func() {
		defer pumps.Done()
		s.pumpReaderToSocket(stderr)
	}()

	// When PowerShell exits on its own (e.g. the user typed `exit`), close the
	// socket so the server-side and the stdin pump unblock and tear down.
	waitErr := cmd.Wait()
	s.shutdown()

	pumps.Wait()

	if waitErr != nil {
		return fmt.Errorf("live terminal powershell exited: %w", waitErr)
	}
	return nil
}

// pumpSocketToStdin forwards operator keystrokes from the socket into the process.
func (s *liveTerminalSession) pumpSocketToStdin(stdin io.WriteCloser) {
	defer stdin.Close()
	for {
		messageType, data, err := s.conn.ReadMessage()
		if err != nil {
			// Socket closed by the server or the network dropped: kill the
			// process so we never leave a zombie PowerShell behind.
			s.killProcess()
			return
		}
		if messageType != websocket.TextMessage && messageType != websocket.BinaryMessage {
			continue
		}
		if _, err := stdin.Write(data); err != nil {
			s.killProcess()
			return
		}
	}
}

// pumpReaderToSocket streams process output to the socket until EOF or error.
func (s *liveTerminalSession) pumpReaderToSocket(reader io.Reader) {
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
	if s.cmd == nil || s.cmd.Process == nil {
		return
	}
	if err := procexec.KillProcessTree(s.cmd.Process.Pid); err != nil {
		log.Printf("live terminal: kill powershell process tree: %v", err)
	}
}
