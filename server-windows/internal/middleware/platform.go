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

// agnosticRoutes are console-wide routes that happen to sit under a platform
// prefix for gateway routing reasons. Role administration spans both ecosystems,
// and the profile route reports the caller's own scope, so scoping either to
// Windows would lock out Android operators.
var agnosticRoutes = []string{
	"/rest/windows/roles",
	"/api/windows/roles",
	"/rest/windows/me",
	"/api/windows/me",
	"/rest/sso/settings",
	"/api/sso/settings",
	"/rest/windows/sso-settings",
	"/api/windows/sso-settings",
}

// coversPath reports whether route is an exact match for path or one of its
// parent segments. Plain prefix matching would let "/rest/windows/me" claim an
// unrelated "/rest/windows/messages" route.
func coversPath(path, route string) bool {
	return path == route || strings.HasPrefix(path, route+"/")
}

// PlatformForPath maps a request path to the device ecosystem it manages, or
// returns an empty string when the route is ecosystem agnostic.
func PlatformForPath(path string) string {
	normalized := strings.ToLower(strings.TrimSuffix(path, "/"))

	for _, route := range agnosticRoutes {
		if coversPath(normalized, route) {
			return ""
		}
	}

	for _, prefix := range windowsPathPrefixes {
		if coversPath(normalized, prefix) {
			return models.PlatformScopeWindows
		}
	}
	for _, prefix := range androidPathPrefixes {
		if coversPath(normalized, prefix) {
			return models.PlatformScopeAndroid
		}
	}

	return ""
}
