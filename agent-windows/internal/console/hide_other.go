//go:build !windows

package console

// HideWindow is a no-op on non-Windows platforms.
func HideWindow() {}
