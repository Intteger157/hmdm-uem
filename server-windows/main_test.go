package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/handlers"
	"github.com/hmdm/server-windows/internal/middleware"
	"github.com/hmdm/server-windows/internal/models"
)

// newTestRouter registers the production route table. It panics if the route
// tree conflicts, which is the failure mode the split into agent/admin groups
// could realistically introduce.
func newTestRouter(t *testing.T) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	// Handlers reached in these tests have no database behind them and panic on
	// the nil connection. Recovery turns that into a 500, matching the
	// gin.Default() stack used in production, so the assertions below stay
	// focused on which middleware ran rather than on handler internals.
	router.Use(gin.Recovery())
	registerRoutes(router, handlers.NewWindowsHandler(), "")
	return router
}

func statusFor(t *testing.T, router *gin.Engine, method, path string) int {
	t.Helper()

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(method, path, nil))
	return recorder.Code
}

func TestRegisterRoutesBuildsRouteTree(t *testing.T) {
	router := newTestRouter(t)

	if len(router.Routes()) == 0 {
		t.Fatal("registerRoutes() produced no routes")
	}
}

// Routes are exercised without a database connection and without a configured
// JWT secret, so the admin middleware short-circuits with 503. That status is a
// reliable marker that the middleware is attached — the handlers themselves
// never return it.
const adminGuardStatus = http.StatusServiceUnavailable

func TestAdminRoutesAreGuarded(t *testing.T) {
	router := newTestRouter(t)

	guarded := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/rest/windows/devices"},
		{http.MethodGet, "/rest/windows/devices/abc123"},
		{http.MethodDelete, "/rest/windows/devices/abc123"},
		{http.MethodPost, "/rest/windows/devices/abc123/commands"},
		{http.MethodGet, "/rest/windows/devices/abc123/logs"},
		{http.MethodGet, "/rest/windows/devices/abc123/services"},
		{http.MethodGet, "/rest/windows/devices/abc123/terminal"},
		{http.MethodGet, "/rest/windows/devices/abc123/apps/status"},
		{http.MethodGet, "/rest/windows/configurations"},
		{http.MethodPost, "/rest/windows/configurations"},
		{http.MethodGet, "/rest/windows/apps"},
		{http.MethodGet, "/rest/windows/files"},
		{http.MethodGet, "/rest/windows/scripts"},
		{http.MethodGet, "/rest/windows/groups"},
		{http.MethodGet, "/rest/windows/roles"},
		{http.MethodPut, "/rest/windows/roles/3"},
		{http.MethodGet, "/api/windows/roles"},
		{http.MethodPut, "/api/windows/roles/3"},
		{http.MethodGet, "/rest/windows/me"},
		{http.MethodGet, "/api/windows/me"},
		{http.MethodGet, "/rest/windows/enrollment-setup"},
		{http.MethodGet, "/rest/windows/enrollment-security"},
		{http.MethodPost, "/rest/windows/enrollment-token"},
		{http.MethodGet, "/rest/windows/autopilot-agent"},
		{http.MethodGet, "/rest/windows/installers/default"},
		{http.MethodGet, "/api/terminal/admin"},
		{http.MethodGet, "/api/terminal/operator"},
		{http.MethodGet, "/api/taskmgr/admin"},
		{http.MethodGet, "/api/filexplorer/admin"},
		{http.MethodGet, "/rest/sso/settings"},
		{http.MethodPut, "/rest/sso/settings"},
		{http.MethodGet, "/api/sso/settings"},
		{http.MethodPut, "/api/sso/settings"},
	}

	for _, route := range guarded {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			if got := statusFor(t, router, route.method, route.path); got != adminGuardStatus {
				t.Errorf("status = %d, want %d (admin middleware missing)", got, adminGuardStatus)
			}
		})
	}
}

// isOperatorRelayPath spots the console-facing halves of the remote-session
// relays. The agent halves carry an enrollment token instead of a console JWT and
// are authorised inside their handlers.
func isOperatorRelayPath(path string) bool {
	if strings.HasSuffix(path, "/agent") || strings.HasSuffix(path, "/client") {
		return false
	}
	return strings.Contains(path, "/terminal") ||
		strings.Contains(path, "/taskmgr") ||
		strings.Contains(path, "/filexplorer")
}

func TestOperatorRelayRoutesRequireEngineerLevel(t *testing.T) {
	// Walks the real route table rather than a hand-written list, so a relay added
	// later is classified before it ships. These routes are GETs — a WebSocket
	// handshake is — and would otherwise read as harmless to an Observer.
	router := newTestRouter(t)

	checked := 0
	for _, route := range router.Routes() {
		if !isOperatorRelayPath(route.Path) {
			continue
		}
		checked++

		got := middleware.MinimumAccessLevelFor(route.Method, route.Path)
		if got != models.AccessLevelHigh {
			t.Errorf("%s %s requires %q, want %q: remote sessions must not be reachable below the Engineer level",
				route.Method, route.Path, got, models.AccessLevelHigh)
		}
	}

	if checked == 0 {
		t.Fatal("no operator relay routes matched — isOperatorRelayPath is out of date")
	}
}

func TestAgentRoutesKeepTheirOwnAuth(t *testing.T) {
	router := newTestRouter(t)

	// The agent protocol must never hit the console JWT middleware, otherwise
	// enrolled devices would stop checking in.
	agentRoutes := []struct {
		method string
		path   string
	}{
		{http.MethodPost, "/rest/windows/enroll"},
		{http.MethodPost, "/rest/windows/checkin"},
		{http.MethodPost, "/rest/windows/inventory"},
		{http.MethodPost, "/rest/windows/uninstall"},
		{http.MethodGet, "/rest/windows/commands/poll"},
		{http.MethodPost, "/rest/windows/commands/7/complete"},
		{http.MethodPost, "/rest/windows/commands/7/result"},
		{http.MethodGet, "/rest/windows/devices/abc123/configurations"},
		{http.MethodPost, "/rest/windows/devices/abc123/policy-enforcement"},
		{http.MethodPost, "/rest/windows/devices/abc123/bitlocker-key"},
		{http.MethodPost, "/rest/windows/devices/abc123/apps/status"},
		{http.MethodPost, "/rest/windows/devices/abc123/logs/app-install"},
		{http.MethodPost, "/rest/windows/devices/abc123/logs/file-deployment"},
	}

	for _, route := range agentRoutes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			if got := statusFor(t, router, route.method, route.path); got == adminGuardStatus {
				t.Errorf("status = %d: agent route is behind the console JWT middleware", got)
			}
		})
	}
}

func TestPublicRoutesNeedNoCredentials(t *testing.T) {
	router := newTestRouter(t)

	if got := statusFor(t, router, http.MethodGet, "/rest/windows/health"); got != http.StatusOK {
		t.Errorf("health status = %d, want %d", got, http.StatusOK)
	}
	if got := statusFor(t, router, http.MethodGet, "/rest/windows/enroll"); got == adminGuardStatus {
		t.Errorf("bootstrap script status = %d: public route is behind the console JWT middleware", got)
	}
}

func TestSharedEffectiveConfigRejectsAnonymousCallers(t *testing.T) {
	router := newTestRouter(t)

	// Reachable by both the agent and the console, but never without credentials.
	got := statusFor(t, router, http.MethodGet, "/rest/windows/devices/abc123/effective-config")
	if got != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", got, http.StatusUnauthorized)
	}
}
