//go:build windows

package taskmgr

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	dialTimeout       = 15 * time.Second
	processPollEvery  = 2500 * time.Millisecond
)

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

// StartTaskManagerSession dials wsURL and streams process snapshots until the
// socket closes or the session is cancelled.
func StartTaskManagerSession(wsURL, token, hardwareID string) error {
	dialer := websocket.Dialer{HandshakeTimeout: dialTimeout}
	conn, resp, err := dialer.Dial(wsURL, buildDialHeader(token, hardwareID))
	if err != nil {
		if resp != nil {
			return fmt.Errorf("task manager dial (%s): %w", resp.Status, err)
		}
		return fmt.Errorf("task manager dial: %w", err)
	}

	session := &taskManagerSession{conn: conn}
	return session.run()
}

type taskManagerSession struct {
	conn *websocket.Conn

	writeMu sync.Mutex
}

func (s *taskManagerSession) run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	defer s.conn.Close()

	go func() {
		<-ctx.Done()
		_ = s.conn.Close()
	}()

	errCh := make(chan error, 2)
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := s.streamProcesses(ctx); err != nil {
			errCh <- err
			cancel()
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := s.listenCommands(ctx); err != nil {
			errCh <- err
			cancel()
		}
	}()

	wg.Wait()

	select {
	case err := <-errCh:
		if err != nil && err != context.Canceled {
			return err
		}
	default:
	}
	return nil
}

func (s *taskManagerSession) streamProcesses(ctx context.Context) error {
	ticker := time.NewTicker(processPollEvery)
	defer ticker.Stop()

	if err := s.publishProcesses(); err != nil {
		return err
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			if err := s.publishProcesses(); err != nil {
				return err
			}
		}
	}
}

func (s *taskManagerSession) publishProcesses() error {
	processes, err := collectProcessSnapshots()
	if err != nil {
		return err
	}

	payload, err := encodeProcessListMessage(processes)
	if err != nil {
		return err
	}

	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	return s.conn.WriteMessage(websocket.TextMessage, payload)
}

func (s *taskManagerSession) listenCommands(ctx context.Context) error {
	for {
		if ctx.Err() != nil {
			return ctx.Err()
		}

		_, data, err := s.conn.ReadMessage()
		if err != nil {
			return err
		}

		cmd, err := parseKillCommand(data)
		if err != nil {
			log.Printf("task manager: ignore command: %v", err)
			continue
		}

		if err := killProcessByPID(cmd.PID); err != nil {
			log.Printf("task manager: kill pid=%d failed: %v", cmd.PID, err)
			continue
		}
		log.Printf("task manager: killed pid=%d", cmd.PID)
	}
}
