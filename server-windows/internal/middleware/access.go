package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
)

// readOnlyMethods cannot change state, so the lowest level may use them.
//
// The converse does not hold, which is the trap this file exists to avoid: a
// WebSocket handshake is a GET, so several GET routes below open an interactive
// session on the device. Ranking routes by method alone would hand an Observer
// remote code execution.
var readOnlyMethods = map[string]struct{}{
	http.MethodGet:     {},
	http.MethodHead:    {},
	http.MethodOptions: {},
}

// highOnlyRoutes require the highest level for every method.
//
// Each one relays a live session to the agent: a shell, a process list that can
// kill, or a file browser that can upload and execute.
var highOnlyRoutes = []string{
	"/api/terminal/operator",
	"/api/terminal/admin",
	"/api/taskmgr/admin",
	"/api/filexplorer/admin",
	"/rest/windows/devices/:hardwareId/terminal",
	"/rest/sso/settings",
	"/api/sso/settings",
}

// methodRoute pairs an HTTP method with a gin route pattern.
type methodRoute struct {
	method  string
	pattern string
}

// highOnlyMutations are the writes an Operator must not reach. Every other write
// falls through to the Operator minimum, so this list is the whole definition of
// "destructive" for the middle level — edit it here rather than at call sites.
//
// The common thread is loss that outlives the request: each one discards data or
// breaks other records that reference it, and none can be undone by repeating
// the opposite call. Uploading and re-assigning, by contrast, are recoverable and
// stay at the Operator level.
var highOnlyMutations = []methodRoute{
	// Unassigns the profile from every device and group still using it.
	{http.MethodDelete, "/rest/windows/configurations/:id"},
	// Discards the uploaded installer and breaks configurations requiring it.
	{http.MethodDelete, "/rest/windows/apps/:id"},
	{http.MethodDelete, "/rest/windows/apps/:id/versions/:versionId"},
	{http.MethodDelete, "/rest/windows/scripts/:id"},
	// Drops the device's command history and forces a re-enrolment.
	{http.MethodDelete, "/rest/windows/devices/:hardwareId"},
}

// commandEnqueueRoutes accept a command identifier in the request body, so their
// policy cannot be decided from the method and path alone.
var commandEnqueueRoutes = []string{
	"/rest/windows/devices/:hardwareId/commands",
}

// privilegedCommands are the command identifiers an Operator must not enqueue.
//
// They share the routine POST .../commands route with sync, lock and restart,
// which is why enforceCommandPolicy has to read the body. The request carries
// "action" and "commandName" as separate fields and the handler honours either,
// so both are checked.
var privilegedCommands = map[string]struct{}{
	"wipe":                {}, // irreversible loss of the device's data
	"powershell":          {}, // runs an operator-supplied script as SYSTEM
	"start_task_manager":  {}, // same session as the taskmgr relay
	"start_file_explorer": {}, // same session as the file explorer relay
	"remote_support":      {}, // hands over an interactive desktop
}

// maxCommandBodyBytes caps the body enforceCommandPolicy will buffer. Only an
// Operator's request is ever read here — a higher level skips the check and a
// lower one is already refused by method — and a command envelope is a few
// hundred bytes plus an optional script.
const maxCommandBodyBytes = 1 << 20

// MinimumAccessLevelFor reports the least access level allowed to call a route,
// given the HTTP method and the gin route pattern that matched.
//
// Unlisted routes fail closed onto the Operator level whenever the method is not
// read-only, so a newly added write is guarded before anyone remembers to
// classify it.
func MinimumAccessLevelFor(method, pattern string) string {
	pattern = strings.TrimSuffix(pattern, "/")
	method = strings.ToUpper(strings.TrimSpace(method))

	for _, route := range highOnlyRoutes {
		if pattern == route {
			return models.AccessLevelHigh
		}
	}
	for _, rule := range highOnlyMutations {
		if rule.method == method && rule.pattern == pattern {
			return models.AccessLevelHigh
		}
	}
	if _, readOnly := readOnlyMethods[method]; readOnly {
		return models.AccessLevelLow
	}
	return models.AccessLevelMid
}

// RequireAccessLevel enforces the access-level half of the RBAC matrix. It must
// be mounted after AdminAuth, which resolves the role it reads.
//
// Fail-closed on both axes: an unresolved role is refused, and an unclassified
// route is treated as a write.
func RequireAccessLevel() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := CurrentRole(c)
		if !ok {
			abortUnresolvedRole(c)
			return
		}

		pattern := routePattern(c)
		required := MinimumAccessLevelFor(c.Request.Method, pattern)
		if !role.AllowsAccessLevel(required) {
			denyAccessLevel(c, role, required, c.Request.Method+" "+c.Request.URL.Path)
			return
		}

		if isCommandEnqueueRoute(pattern) && !enforceCommandPolicy(c, role) {
			return
		}

		c.Next()
	}
}

// RequireConsoleAdministrator restricts a route to operators who may administer
// the console itself rather than the devices in one ecosystem.
//
// The role matrix routes need this on top of RequireAccessLevel: they write the
// very columns authorisation reads, so a Windows Engineer holding only
// AccessLevelHigh could otherwise widen its own scope to global.
func RequireConsoleAdministrator() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := CurrentRole(c)
		if !ok {
			abortUnresolvedRole(c)
			return
		}

		if !role.IsConsoleAdministrator() {
			log.Printf("[access] denied console administration role=%q scope=%s level=%s %s %s",
				role.Name, role.EffectivePlatformScope(), role.EffectiveAccessLevel(),
				c.Request.Method, c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error": "console administration requires an unrestricted role",
			})
			return
		}

		c.Next()
	}
}

// enforceCommandPolicy blocks privileged command identifiers on the shared
// enqueue route, rewinding the body so the handler still binds it normally.
func enforceCommandPolicy(c *gin.Context, role models.UserRole) bool {
	if role.AllowsAccessLevel(models.AccessLevelHigh) {
		return true
	}
	if c.Request.Body == nil {
		return true
	}

	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxCommandBodyBytes+1))
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return false
	}
	if len(body) > maxCommandBodyBytes {
		c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "command payload is too large"})
		return false
	}
	c.Request.Body = io.NopCloser(bytes.NewReader(body))

	var req struct {
		Action      string `json:"action"`
		CommandName string `json:"commandName"`
	}
	// An unparseable body cannot name a privileged command; let the handler
	// report the binding error rather than masking it as a permission problem.
	if err := json.Unmarshal(body, &req); err != nil {
		return true
	}

	for _, candidate := range []string{req.Action, req.CommandName} {
		name := strings.ToLower(strings.TrimSpace(candidate))
		if name == "" {
			continue
		}
		if _, privileged := privilegedCommands[name]; privileged {
			denyAccessLevel(c, role, models.AccessLevelHigh, "command "+name)
			return false
		}
	}

	return true
}

// routePattern returns the gin route template that matched, which keeps the
// policy tables free of path parameters. It falls back to the raw path, which in
// practice only happens if this middleware is reached without a matched route.
func routePattern(c *gin.Context) string {
	if pattern := c.FullPath(); pattern != "" {
		return pattern
	}
	return c.Request.URL.Path
}

func isCommandEnqueueRoute(pattern string) bool {
	pattern = strings.TrimSuffix(pattern, "/")
	for _, route := range commandEnqueueRoutes {
		if pattern == route {
			return true
		}
	}
	return false
}

func abortUnresolvedRole(c *gin.Context) {
	log.Printf("[access] no resolved role on %s %s — the access middleware must be mounted after AdminAuth",
		c.Request.Method, c.Request.URL.Path)
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
}

func denyAccessLevel(c *gin.Context, role models.UserRole, required, attempted string) {
	log.Printf("[access] denied role=%q level=%s required=%s %s",
		role.Name, role.EffectiveAccessLevel(), required, attempted)
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
		"error": "role access level " + role.EffectiveAccessLevel() +
			" is not permitted to perform this action (" + required + " required)",
	})
}
