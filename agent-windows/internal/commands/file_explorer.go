//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/hmdm/agent-windows/internal/filexplorer"
)

const (
	// CommandNameStartFileExplorer is the poll/inventory action that opens a remote
	// interactive file explorer WebSocket session.
	CommandNameStartFileExplorer = "start_file_explorer"
	defaultFileExplorerPath      = "/api/filexplorer/agent"
)

type fileExplorerPayload struct {
	SessionID string `json:"sessionID"`
	DeviceID  string `json:"deviceID"`
	Path      string `json:"path"`
}

// ExecuteStartFileExplorer parses the server payload, dials the file explorer
// bridge, and blocks until the session ends.
func ExecuteStartFileExplorer(opts ExecuteOptions, payload []byte) Result {
	wsURL, err := resolveFileExplorerWebSocketURL(opts.ServerURL, payload)
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}

	if err := filexplorer.StartFileExplorerSession(wsURL, opts.AuthToken, opts.HardwareID); err != nil {
		return Result{Success: false, Message: err.Error()}
	}
	return Result{Success: true, Message: "file explorer session ended"}
}

func resolveFileExplorerWebSocketURL(serverURL string, payload []byte) (string, error) {
	serverURL = strings.TrimSpace(serverURL)
	if serverURL == "" {
		return "", fmt.Errorf("start_file_explorer: server URL is required")
	}

	var parsed fileExplorerPayload
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &parsed); err != nil {
			return "", fmt.Errorf("start_file_explorer: invalid payload: %w", err)
		}
	}

	sessionID := strings.TrimSpace(parsed.SessionID)
	if sessionID == "" {
		sessionID = strings.TrimSpace(parsed.DeviceID)
	}
	if sessionID == "" {
		return "", fmt.Errorf("start_file_explorer: sessionID is required")
	}

	path := strings.TrimSpace(parsed.Path)
	if path == "" {
		path = defaultFileExplorerPath
	}

	return buildFileExplorerWebSocketURL(serverURL, path, sessionID)
}

func buildFileExplorerWebSocketURL(serverURL, path, sessionID string) (string, error) {
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(serverURL), "/"))
	if err != nil {
		return "", fmt.Errorf("start_file_explorer: parse server URL: %w", err)
	}

	switch strings.ToLower(base.Scheme) {
	case "https":
		base.Scheme = "wss"
	case "http":
		base.Scheme = "ws"
	default:
		return "", fmt.Errorf("start_file_explorer: unsupported server URL scheme %q", base.Scheme)
	}

	path = strings.TrimSpace(path)
	if path == "" {
		path = defaultFileExplorerPath
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
