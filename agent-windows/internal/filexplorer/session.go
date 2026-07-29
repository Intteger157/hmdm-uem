//go:build windows

package filexplorer

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

const dialTimeout = 15 * time.Second

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

// StartFileExplorerSession dials wsURL and handles remote file explorer commands
// until the socket closes.
func StartFileExplorerSession(wsURL, token, hardwareID string) error {
	dialer := websocket.Dialer{HandshakeTimeout: dialTimeout}
	conn, resp, err := dialer.Dial(wsURL, buildDialHeader(token, hardwareID))
	if err != nil {
		if resp != nil {
			return fmt.Errorf("file explorer dial (%s): %w", resp.Status, err)
		}
		return fmt.Errorf("file explorer dial: %w", err)
	}

	session := &fileExplorerSession{conn: conn}
	return session.run()
}

type fileExplorerSession struct {
	conn *websocket.Conn
}

func (s *fileExplorerSession) run() error {
	defer s.conn.Close()

	for {
		messageType, data, err := s.conn.ReadMessage()
		if err != nil {
			return err
		}
		if messageType != websocket.TextMessage {
			log.Printf("file explorer: ignore non-text command messageType=%d", messageType)
			continue
		}

		if err := s.handleCommand(data); err != nil {
			log.Printf("file explorer: command failed: %v", err)
		}
	}
}

func (s *fileExplorerSession) handleCommand(data []byte) error {
	cmd, err := parseIncomingCommand(data)
	if err != nil {
		return s.sendError(fmt.Sprintf("invalid command: %v", err))
	}

	switch cmd.Action {
	case ActionReadDir:
		return s.handleReadDir(cmd.Path)
	case ActionDownload:
		return s.handleDownload(cmd.Path)
	default:
		return s.sendError(fmt.Sprintf("unsupported action: %s", cmd.Action))
	}
}

func (s *fileExplorerSession) handleReadDir(path string) error {
	response, err := buildDirListResponse(path)
	if err != nil {
		return s.sendError(publicErrorMessage(err))
	}

	payload, err := encodeJSONMessage(response)
	if err != nil {
		return err
	}
	return s.conn.WriteMessage(websocket.TextMessage, payload)
}

func (s *fileExplorerSession) handleDownload(path string) error {
	if err := streamFileDownload(s.conn, path); err != nil {
		return s.sendError(publicErrorMessage(err))
	}
	return nil
}

func (s *fileExplorerSession) sendError(message string) error {
	payload, err := encodeJSONMessage(errorMessage{
		Type:    MessageTypeError,
		Message: message,
	})
	if err != nil {
		return err
	}
	return s.conn.WriteMessage(websocket.TextMessage, payload)
}
