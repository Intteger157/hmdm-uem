package middleware

import (
	"strings"

	"github.com/hmdm/server-windows/internal/models"
)

// windowsPathPrefixes are the routes that manage Windows devices. The terminal,
// task manager and file explorer relays are listed here because only the
// Windows agent implements them today.
var windowsPathPrefixes = []string{
	"/rest/windows",
	"/api/windows",
	"/api/terminal",
	"/api/taskmgr",
	"/api/filexplorer",
}

// androidPathPrefixes are reserved for the Android side of the console, which
// the Java server still serves. They are listed so a Windows-scoped operator is
// rejected consistently once those routes move here.
var androidPathPrefixes = []string{
	"/rest/android",
	"/api/android",
}

// agnosticPathPrefixes are console-wide administration routes that happen to sit
// under a platform prefix for gateway routing reasons. Role administration spans
// both ecosystems, so scoping it to Windows would lock out Android operators.
var agnosticPathPrefixes = []string{
	"/rest/windows/roles",
	"/api/windows/roles",
}

// PlatformForPath maps a request path to the device ecosystem it manages, or
// returns an empty string when the route is ecosystem agnostic.
func PlatformForPath(path string) string {
	normalized := strings.ToLower(path)

	for _, prefix := range agnosticPathPrefixes {
		if strings.HasPrefix(normalized, prefix) {
			return ""
		}
	}

	for _, prefix := range windowsPathPrefixes {
		if strings.HasPrefix(normalized, prefix) {
			return models.PlatformScopeWindows
		}
	}
	for _, prefix := range androidPathPrefixes {
		if strings.HasPrefix(normalized, prefix) {
			return models.PlatformScopeAndroid
		}
	}

	return ""
}
