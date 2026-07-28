//go:build windows

package terminal

import "encoding/json"

type terminalControlMessage struct {
	Type string `json:"type"`
	Cols int    `json:"cols"`
	Rows int    `json:"rows"`
}

func tryHandleControlMessage(cpty resizeTarget, data []byte) bool {
	if len(data) == 0 || data[0] != '{' {
		return false
	}

	var msg terminalControlMessage
	if err := json.Unmarshal(data, &msg); err != nil || msg.Type != "resize" {
		return false
	}
	if msg.Cols < 20 || msg.Rows < 5 {
		return true
	}
	_ = cpty.Resize(msg.Cols, msg.Rows)
	return true
}

type resizeTarget interface {
	Resize(width, height int) error
}
