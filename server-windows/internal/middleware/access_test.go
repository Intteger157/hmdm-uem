package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
)

func TestMinimumAccessLevelForReads(t *testing.T) {
	reads := []string{
		"/rest/windows/devices",
		"/rest/windows/devices/:hardwareId",
		"/rest/windows/configurations",
		"/rest/windows/files",
		"/rest/windows/me",
	}

	for _, pattern := range reads {
		if got := MinimumAccessLevelFor(http.MethodGet, pattern); got != models.AccessLevelLow {
			t.Errorf("MinimumAccessLevelFor(GET, %q) = %q, want %q", pattern, got, models.AccessLevelLow)
		}
	}
}

func TestMinimumAccessLevelForRoutineWrites(t *testing.T) {
	// The Operator level exists for day-to-day maintenance: uploading, saving and
	// assigning must not require an Engineer.
	writes := []methodRoute{
		{http.MethodPost, "/rest/windows/files/upload"},
		{http.MethodPost, "/rest/windows/configurations"},
		{http.MethodPut, "/rest/windows/configurations/:id"},
		{http.MethodPost, "/rest/windows/configurations/:id/assign"},
		{http.MethodPost, "/rest/windows/apps"},
		{http.MethodPut, "/rest/windows/apps/:id"},
		{http.MethodPost, "/rest/windows/applications/upload"},
		{http.MethodPost, "/rest/windows/devices/:hardwareId/apps/:appId/assign"},
		{http.MethodPost, "/rest/windows/devices/:hardwareId/services/refresh"},
		{http.MethodPatch, "/rest/windows/devices/:hardwareId/group"},
		// Unassigning is recoverable by assigning again, unlike deleting the app.
		{http.MethodDelete, "/rest/windows/devices/:hardwareId/apps/:appId/assign"},
		{http.MethodDelete, "/rest/windows/files/:id"},
	}

	for _, write := range writes {
		got := MinimumAccessLevelFor(write.method, write.pattern)
		if got != models.AccessLevelMid {
			t.Errorf("MinimumAccessLevelFor(%s, %q) = %q, want %q",
				write.method, write.pattern, got, models.AccessLevelMid)
		}
	}
}

func TestMinimumAccessLevelForDestructiveWrites(t *testing.T) {
	destructive := []methodRoute{
		{http.MethodDelete, "/rest/windows/configurations/:id"},
		{http.MethodDelete, "/rest/windows/apps/:id"},
		{http.MethodDelete, "/rest/windows/apps/:id/versions/:versionId"},
		{http.MethodDelete, "/rest/windows/scripts/:id"},
		{http.MethodDelete, "/rest/windows/devices/:hardwareId"},
	}

	for _, route := range destructive {
		got := MinimumAccessLevelFor(route.method, route.pattern)
		if got != models.AccessLevelHigh {
			t.Errorf("MinimumAccessLevelFor(%s, %q) = %q, want %q",
				route.method, route.pattern, got, models.AccessLevelHigh)
		}
	}
}

func TestMinimumAccessLevelForRelaysIgnoresReadOnlyMethod(t *testing.T) {
	// The regression this guards: a WebSocket handshake is a GET, so classifying
	// by method would let an Observer open a shell, kill processes or run a file.
	relays := []string{
		"/api/terminal/operator",
		"/api/terminal/admin",
		"/api/taskmgr/admin",
		"/api/filexplorer/admin",
		"/rest/windows/devices/:hardwareId/terminal",
	}

	for _, pattern := range relays {
		if got := MinimumAccessLevelFor(http.MethodGet, pattern); got != models.AccessLevelHigh {
			t.Errorf("MinimumAccessLevelFor(GET, %q) = %q, want %q", pattern, got, models.AccessLevelHigh)
		}
	}
}

func TestMinimumAccessLevelForUnknownWriteFailsClosed(t *testing.T) {
	// A route added later must be guarded before anyone classifies it.
	if got := MinimumAccessLevelFor(http.MethodPost, "/rest/windows/not-yet-invented"); got != models.AccessLevelMid {
		t.Errorf("MinimumAccessLevelFor(POST, unknown) = %q, want %q", got, models.AccessLevelMid)
	}
}

// newAccessRouter mounts RequireAccessLevel behind a stub that seeds the role the
// real AdminAuth would have resolved.
func newAccessRouter(role *models.UserRole) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if role != nil {
		router.Use(func(c *gin.Context) {
			c.Set(ContextUserKey, models.User{ID: 1, Login: "operator"})
			c.Set(ContextRoleKey, *role)
		})
	}
	router.Use(RequireAccessLevel())

	ok := func(c *gin.Context) { c.String(http.StatusOK, "ok") }
	router.GET("/rest/windows/devices", ok)
	router.DELETE("/rest/windows/devices/:hardwareId", ok)
	router.POST("/rest/windows/files/upload", ok)
	router.DELETE("/rest/windows/configurations/:id", ok)
	router.GET("/api/taskmgr/admin", ok)
	// Echoes the body so the rewind after inspection is observable.
	router.POST("/rest/windows/devices/:hardwareId/commands", func(c *gin.Context) {
		var req models.EnqueueCommandRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.String(http.StatusBadRequest, "bind: %v", err)
			return
		}
		c.String(http.StatusOK, "%s|%s", req.Action, req.CommandName)
	})
	return router
}

func call(router *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	var request *http.Request
	if body == "" {
		request = httptest.NewRequest(method, path, nil)
	} else {
		request = httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
	}
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestRequireAccessLevelObserverMayOnlyRead(t *testing.T) {
	router := newAccessRouter(&models.UserRole{Name: "Observer", AccessLevel: models.AccessLevelLow})

	if got := call(router, http.MethodGet, "/rest/windows/devices", "").Code; got != http.StatusOK {
		t.Errorf("GET devices = %d, want %d", got, http.StatusOK)
	}
	if got := call(router, http.MethodPost, "/rest/windows/files/upload", "").Code; got != http.StatusForbidden {
		t.Errorf("POST upload = %d, want %d", got, http.StatusForbidden)
	}
	if got := call(router, http.MethodDelete, "/rest/windows/devices/abc", "").Code; got != http.StatusForbidden {
		t.Errorf("DELETE device = %d, want %d", got, http.StatusForbidden)
	}
	// The point of the relay list: this is a GET but must still be refused.
	if got := call(router, http.MethodGet, "/api/taskmgr/admin", "").Code; got != http.StatusForbidden {
		t.Errorf("GET task manager relay = %d, want %d", got, http.StatusForbidden)
	}
}

func TestRequireAccessLevelOperatorMayMaintainButNotDestroy(t *testing.T) {
	router := newAccessRouter(&models.UserRole{Name: "Operator", AccessLevel: models.AccessLevelMid})

	if got := call(router, http.MethodPost, "/rest/windows/files/upload", "").Code; got != http.StatusOK {
		t.Errorf("POST upload = %d, want %d", got, http.StatusOK)
	}
	if got := call(router, http.MethodDelete, "/rest/windows/configurations/4", "").Code; got != http.StatusForbidden {
		t.Errorf("DELETE configuration = %d, want %d", got, http.StatusForbidden)
	}
	if got := call(router, http.MethodGet, "/api/taskmgr/admin", "").Code; got != http.StatusForbidden {
		t.Errorf("GET task manager relay = %d, want %d", got, http.StatusForbidden)
	}
}

func TestRequireAccessLevelEngineerMayDoEverything(t *testing.T) {
	router := newAccessRouter(&models.UserRole{Name: "Engineer", AccessLevel: models.AccessLevelHigh})

	for _, tt := range []struct {
		method, path, body string
	}{
		{http.MethodGet, "/rest/windows/devices", ""},
		{http.MethodPost, "/rest/windows/files/upload", ""},
		{http.MethodDelete, "/rest/windows/configurations/4", ""},
		{http.MethodGet, "/api/taskmgr/admin", ""},
		{http.MethodPost, "/rest/windows/devices/abc/commands", `{"action":"wipe"}`},
	} {
		if got := call(router, tt.method, tt.path, tt.body).Code; got != http.StatusOK {
			t.Errorf("%s %s = %d, want %d", tt.method, tt.path, got, http.StatusOK)
		}
	}
}

func TestRequireAccessLevelFiltersCommandsByIdentifier(t *testing.T) {
	router := newAccessRouter(&models.UserRole{Name: "Operator", AccessLevel: models.AccessLevelMid})

	allowed := []string{
		`{"action":"sync"}`,
		`{"action":"lock"}`,
		`{"action":"restart"}`,
		`{"action":"apply_configuration"}`,
		`{"commandName":"UninstallApp","payload":"{}"}`,
		`{"commandName":"battery_report"}`,
	}
	for _, body := range allowed {
		if got := call(router, http.MethodPost, "/rest/windows/devices/abc/commands", body).Code; got != http.StatusOK {
			t.Errorf("POST %s = %d, want %d", body, got, http.StatusOK)
		}
	}

	// Wipe and powershell share this route with the routine actions above, and
	// the relay commands would otherwise reopen the sessions the route list
	// blocks.
	denied := []string{
		`{"action":"wipe"}`,
		`{"action":"powershell","payload":"{\"script\":\"whoami\"}"}`,
		`{"commandName":"start_task_manager"}`,
		`{"commandName":"start_file_explorer"}`,
		`{"commandName":"remote_support"}`,
		`{"action":"  WIPE  "}`,
	}
	for _, body := range denied {
		if got := call(router, http.MethodPost, "/rest/windows/devices/abc/commands", body).Code; got != http.StatusForbidden {
			t.Errorf("POST %s = %d, want %d", body, got, http.StatusForbidden)
		}
	}
}

func TestRequireAccessLevelRewindsInspectedBody(t *testing.T) {
	// The middleware consumes the body to read the command name, so the handler
	// must still be able to bind it.
	router := newAccessRouter(&models.UserRole{Name: "Operator", AccessLevel: models.AccessLevelMid})

	recorder := call(router, http.MethodPost, "/rest/windows/devices/abc/commands", `{"action":"sync"}`)
	if recorder.Body.String() != "sync|" {
		t.Errorf("handler saw %q, want %q", recorder.Body.String(), "sync|")
	}
}

func TestRequireAccessLevelSuperAdminBypassesTheMatrix(t *testing.T) {
	router := newAccessRouter(&models.UserRole{
		Name:        "Legacy Super-Admin",
		AccessLevel: models.AccessLevelLow,
		SuperAdmin:  true,
	})

	if got := call(router, http.MethodDelete, "/rest/windows/configurations/4", "").Code; got != http.StatusOK {
		t.Errorf("DELETE configuration = %d, want %d", got, http.StatusOK)
	}
	if got := call(router, http.MethodPost, "/rest/windows/devices/abc/commands", `{"action":"wipe"}`).Code; got != http.StatusOK {
		t.Errorf("POST wipe = %d, want %d", got, http.StatusOK)
	}
}

func TestRequireAccessLevelRefusesUnresolvedRole(t *testing.T) {
	// Only reachable if the middleware is mounted outside AdminAuth; refusing is
	// noisy but cannot leak.
	if got := call(newAccessRouter(nil), http.MethodGet, "/rest/windows/devices", "").Code; got != http.StatusForbidden {
		t.Errorf("status = %d, want %d", got, http.StatusForbidden)
	}
}

func TestRequireConsoleAdministrator(t *testing.T) {
	tests := []struct {
		name string
		role models.UserRole
		want int
	}{
		{"global engineer allowed",
			models.UserRole{PlatformScope: models.PlatformScopeGlobal, AccessLevel: models.AccessLevelHigh},
			http.StatusOK},
		{"super admin allowed",
			models.UserRole{PlatformScope: models.PlatformScopeWindows, AccessLevel: models.AccessLevelLow, SuperAdmin: true},
			http.StatusOK},
		// The escalation this guard closes: role editing writes platform_scope
		// and access_level, so a Windows Engineer could grant itself global.
		{"windows engineer refused",
			models.UserRole{PlatformScope: models.PlatformScopeWindows, AccessLevel: models.AccessLevelHigh},
			http.StatusForbidden},
		{"global operator refused",
			models.UserRole{PlatformScope: models.PlatformScopeGlobal, AccessLevel: models.AccessLevelMid},
			http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			router := gin.New()
			router.Use(func(c *gin.Context) {
				c.Set(ContextUserKey, models.User{ID: 1, Login: "operator"})
				c.Set(ContextRoleKey, tt.role)
			})
			router.PUT("/rest/windows/roles/:roleId", RequireConsoleAdministrator(),
				func(c *gin.Context) { c.String(http.StatusOK, "ok") })

			if got := call(router, http.MethodPut, "/rest/windows/roles/2", "").Code; got != tt.want {
				t.Errorf("status = %d, want %d", got, tt.want)
			}
		})
	}
}
