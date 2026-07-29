//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/hmdm/agent-windows/internal/taskmgr"
)

const (
	// CommandNameStartTaskManager is the poll/inventory action that opens a remote
	// task manager WebSocket session.
	CommandNameStartTaskManager = "start_task_manager"
	defaultTaskManagerPath      = "/api/taskmgr/agent"
)

type taskManagerPayload struct {
	SessionID string `json:"sessionID"`
	DeviceID  string `json:"deviceID"`
	Path      string `json:"path"`
}

// ExecuteStartTaskManager parses the server payload, dials the task manager
// bridge, and blocks until the session ends.
func ExecuteStartTaskManager(opts ExecuteOptions, payload []byte) Result {
	wsURL, err := resolveTaskManagerWebSocketURL(opts.ServerURL, payload)
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}

	if err := taskmgr.StartTaskManagerSession(wsURL, opts.AuthToken, opts.HardwareID); err != nil {
		return Result{Success: false, Message: err.Error()}
	}
	return Result{Success: true, Message: "task manager session ended"}
}

func resolveTaskManagerWebSocketURL(serverURL string, payload []byte) (string, error) {
	serverURL = strings.TrimSpace(serverURL)
	if serverURL == "" {
		return "", fmt.Errorf("start_task_manager: server URL is required")
	}

	var parsed taskManagerPayload
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &parsed); err != nil {
			return "", fmt.Errorf("start_task_manager: invalid payload: %w", err)
		}
	}

	sessionID := strings.TrimSpace(parsed.SessionID)
	if sessionID == "" {
		sessionID = strings.TrimSpace(parsed.DeviceID)
	}
	if sessionID == "" {
		return "", fmt.Errorf("start_task_manager: sessionID is required")
	}

	path := strings.TrimSpace(parsed.Path)
	if path == "" {
		path = defaultTaskManagerPath
	}

	return buildTaskManagerWebSocketURL(serverURL, path, sessionID)
}

func buildTaskManagerWebSocketURL(serverURL, path, sessionID string) (string, error) {
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(serverURL), "/"))
	if err != nil {
		return "", fmt.Errorf("start_task_manager: parse server URL: %w", err)
	}

	switch strings.ToLower(base.Scheme) {
	case "https":
		base.Scheme = "wss"
	case "http":
		base.Scheme = "ws"
	default:
		return "", fmt.Errorf("start_task_manager: unsupported server URL scheme %q", base.Scheme)
	}

	path = strings.TrimSpace(path)
	if path == "" {
		path = defaultTaskManagerPath
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	base.Path = path

	query := base.Query()
	query.Set("deviceID", sessionID)
	base.RawQuery = query.Encode()

	return base.String(), nil
}
