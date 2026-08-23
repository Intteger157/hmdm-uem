//go:build windows

package terminal

// normalizeTerminalInput passes keystrokes through unchanged.
// xterm sends DEL (0x7f) for Backspace; PSReadLine uses that for single-char delete.
// Mapping DEL to BS (0x08) makes PSReadLine treat Backspace as Ctrl+H (kill word).
func normalizeTerminalInput(data []byte) []byte {
	return data
}
