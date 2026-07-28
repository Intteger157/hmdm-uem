//go:build windows

package terminal

import "bytes"

// normalizeTerminalInput maps xterm/backspace (DEL, 0x7f) to Windows BS (0x08)
// so PowerShell line editing works through the relay.
func normalizeTerminalInput(data []byte) []byte {
	if bytes.IndexByte(data, 0x7f) < 0 {
		return data
	}
	return bytes.ReplaceAll(data, []byte{0x7f}, []byte{0x08})
}
