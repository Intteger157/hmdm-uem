//go:build windows

package filexplorer

import (
	"fmt"
	"log"
	"net/http"
	"os"
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
	conn       *websocket.Conn
	uploadFile *os.File
}

func (s *fileExplorerSession) run() error {
	defer s.conn.Close()
	defer s.resetUpload()

	for {
		messageType, data, err := s.conn.ReadMessage()
		if err != nil {
			return err
		}

		if messageType == websocket.BinaryMessage {
			if s.uploadFile != nil {
				if err := writeUploadChunk(s.uploadFile, data); err != nil {
					s.resetUpload()
					if sendErr := s.sendError(publicErrorMessage(err)); sendErr != nil {
						log.Printf("file explorer: upload write failed: %v (notify failed: %v)", err, sendErr)
					}
				}
				continue
			}

			log.Printf("file explorer: ignore unexpected binary message")
			continue
		}

		if messageType != websocket.TextMessage {
			log.Printf("file explorer: ignore messageType=%d", messageType)
			continue
		}

		if err := s.handleCommand(data); err != nil {
			log.Printf("file explorer: command failed: %v", err)
		}
	}
}

func (s *fileExplorerSession) resetUpload() {
	if s.uploadFile == nil {
		return
	}
	_ = s.uploadFile.Close()
	s.uploadFile = nil
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
	case ActionUploadStart:
		return s.handleUploadStart(cmd.Path)
	case ActionUploadEnd:
		return s.handleUploadEnd()
	case ActionExecute:
		return s.handleExecute(cmd.Path)
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

func (s *fileExplorerSession) handleUploadStart(path string) error {
	if s.uploadFile != nil {
		return s.sendError("upload already in progress")
	}

	file, err := openUploadDestination(path)
	if err != nil {
		return s.sendError(publicErrorMessage(err))
	}

	s.uploadFile = file
	return nil
}

func (s *fileExplorerSession) handleUploadEnd() error {
	if s.uploadFile == nil {
		return s.sendError("no upload in progress")
	}

	if err := closeUploadDestination(s.uploadFile); err != nil {
		s.uploadFile = nil
		return s.sendError(publicErrorMessage(err))
	}

	s.uploadFile = nil

	payload, err := encodeJSONMessage(uploadSuccessMessage{Type: MessageTypeUploadSuccess})
	if err != nil {
		return err
	}
	return s.conn.WriteMessage(websocket.TextMessage, payload)
}

func (s *fileExplorerSession) handleExecute(path string) error {
	if err := startExecutable(path); err != nil {
		return s.sendError(publicErrorMessage(err))
	}

	payload, err := encodeJSONMessage(execSuccessMessage{Type: MessageTypeExecSuccess})
	if err != nil {
		return err
	}
	return s.conn.WriteMessage(websocket.TextMessage, payload)
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
