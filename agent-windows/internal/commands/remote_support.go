//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/hmdm/agent-windows/internal/terminal"
)

const (
	// CommandNameRemoteSupport is the poll/inventory action that starts a live
	// diagnostics shell session bridged over WebSocket.
	CommandNameRemoteSupport = "remote_support"
	defaultTerminalPath      = "/api/terminal/client"
)

// ExecuteOptions carries agent runtime credentials needed for actions that dial
// back to the MDM server (for example remote_support).
type ExecuteOptions struct {
	ServerURL  string
	AuthToken  string
	HardwareID string
}

type remoteSupportPayload struct {
	SessionID string `json:"sessionID"`
	DeviceID  string `json:"deviceID"`
	Path      string `json:"path"`
}

// ExecuteRemoteSupport parses the server payload, dials the terminal bridge, and
// blocks until the diagnostics session ends.
func ExecuteRemoteSupport(opts ExecuteOptions, payload []byte) Result {
	wsURL, err := resolveRemoteSupportWebSocketURL(opts.ServerURL, payload)
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}

	if err := terminal.StartLiveTerminal(wsURL, opts.AuthToken, opts.HardwareID); err != nil {
		return Result{Success: false, Message: err.Error()}
	}
	return Result{Success: true, Message: "remote support session ended"}
}

func resolveRemoteSupportWebSocketURL(serverURL string, payload []byte) (string, error) {
	serverURL = strings.TrimSpace(serverURL)
	if serverURL == "" {
		return "", fmt.Errorf("remote_support: server URL is required")
	}

	var parsed remoteSupportPayload
	if len(payload) > 0 {
		if err := json.Unmarshal(payload, &parsed); err != nil {
			return "", fmt.Errorf("remote_support: invalid payload: %w", err)
		}
	}

	sessionID := strings.TrimSpace(parsed.SessionID)
	if sessionID == "" {
		sessionID = strings.TrimSpace(parsed.DeviceID)
	}
	if sessionID == "" {
		return "", fmt.Errorf("remote_support: sessionID is required")
	}

	path := strings.TrimSpace(parsed.Path)
	if path == "" {
		path = defaultTerminalPath
	}

	return buildTerminalWebSocketURL(serverURL, path, sessionID)
}

func buildTerminalWebSocketURL(serverURL, path, sessionID string) (string, error) {
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(serverURL), "/"))
	if err != nil {
		return "", fmt.Errorf("remote_support: parse server URL: %w", err)
	}

	switch strings.ToLower(base.Scheme) {
	case "https":
		base.Scheme = "wss"
	case "http":
		base.Scheme = "ws"
	default:
		return "", fmt.Errorf("remote_support: unsupported server URL scheme %q", base.Scheme)
	}

	path = strings.TrimSpace(path)
	if path == "" {
		path = defaultTerminalPath
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	base.Path = path

	query := base.Query()
	query.Set("sessionID", sessionID)
	base.RawQuery = query.Encode()

	return base.String(), nil
}
