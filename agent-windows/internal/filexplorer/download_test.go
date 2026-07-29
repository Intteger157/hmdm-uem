//go:build windows

package filexplorer

import (
	"os"
	"testing"

	"github.com/gorilla/websocket"
)

type recordingWriter struct {
	messages []recordedMessage
}

type recordedMessage struct {
	messageType int
	data        []byte
}

func (w *recordingWriter) WriteMessage(messageType int, data []byte) error {
	copied := make([]byte, len(data))
	copy(copied, data)
	w.messages = append(w.messages, recordedMessage{
		messageType: messageType,
		data:        copied,
	})
	return nil
}

func TestStreamFileDownloadChunks(t *testing.T) {
	dir := t.TempDir()
	filePath := dir + `\chunk.bin`
	payload := make([]byte, downloadChunkSize+1024)
	for i := range payload {
		payload[i] = byte(i % 251)
	}
	if err := os.WriteFile(filePath, payload, 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	writer := &recordingWriter{}
	if err := streamFileDownload(writer, filePath); err != nil {
		t.Fatalf("streamFileDownload: %v", err)
	}

	if len(writer.messages) < 4 {
		t.Fatalf("expected at least 4 messages, got %d", len(writer.messages))
	}
	if writer.messages[0].messageType != websocket.TextMessage {
		t.Fatalf("first message should be text metadata")
	}
	if writer.messages[len(writer.messages)-1].messageType != websocket.TextMessage {
		t.Fatalf("last message should be download_end")
	}

	var binaryBytes int
	for _, msg := range writer.messages[1 : len(writer.messages)-1] {
		if msg.messageType != websocket.BinaryMessage {
			t.Fatalf("expected binary chunk, got messageType=%d", msg.messageType)
		}
		binaryBytes += len(msg.data)
	}
	if binaryBytes != len(payload) {
		t.Fatalf("streamed bytes = %d want %d", binaryBytes, len(payload))
	}
}
