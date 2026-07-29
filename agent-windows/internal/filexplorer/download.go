//go:build windows

package filexplorer

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/gorilla/websocket"
)

type textWriter interface {
	WriteMessage(messageType int, data []byte) error
}

func streamFileDownload(conn textWriter, path string) error {
	cleanPath, err := normalizeFilePath(path)
	if err != nil {
		return err
	}

	info, err := os.Stat(cleanPath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("path is a directory")
	}

	file, err := os.Open(cleanPath)
	if err != nil {
		return err
	}
	defer file.Close()

	startPayload, err := encodeJSONMessage(downloadStartMessage{
		Type:     MessageTypeDownloadStart,
		Filename: filepath.Base(cleanPath),
		Size:     info.Size(),
	})
	if err != nil {
		return err
	}
	if err := conn.WriteMessage(websocket.TextMessage, startPayload); err != nil {
		return err
	}

	buf := make([]byte, downloadChunkSize)
	for {
		n, readErr := file.Read(buf)
		if n > 0 {
			if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				return err
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				break
			}
			return readErr
		}
	}

	endPayload, err := encodeJSONMessage(downloadEndMessage{Type: MessageTypeDownloadEnd})
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, endPayload)
}
