// Package api provides HTTP communication with the Headwind MDM server.
package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/system"
)

const (
	enrollPath           = "/rest/windows/enroll"
	inventoryPath        = "/rest/windows/inventory"
	pollCommandPath      = "/rest/windows/commands/poll"
	completeCommandPath  = "/rest/windows/commands/%d/complete"
)

// ErrUnauthorized indicates the server rejected the current auth token.
var ErrUnauthorized = errors.New("unauthorized")

// APIClient wraps REST calls to the MDM backend.
type APIClient struct {
	baseURL    string
	httpClient *http.Client
}

type enrollRequest struct {
	EnrollmentToken string `json:"enrollment_token"`
	HardwareID      string `json:"hardware_id"`
}

type enrollResponse struct {
	AuthToken string `json:"auth_token"`
}

type pendingCommandResponse struct {
	ID      uint            `json:"id"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

type completeCommandRequest struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// PendingCommand describes a command fetched from the server queue.
type PendingCommand struct {
	ID      uint
	Action  string
	Payload json.RawMessage
}

// NewAPIClient constructs an API client from the given configuration.
func NewAPIClient(cfg config.Config) *APIClient {
	return &APIClient{
		baseURL: strings.TrimRight(cfg.ServerURL, "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// Enroll registers the device and returns the auth token issued by the server.
func (c *APIClient) Enroll(enrollToken, hwid string) (string, error) {
	payload, err := json.Marshal(enrollRequest{
		EnrollmentToken: enrollToken,
		HardwareID:      hwid,
	})
	if err != nil {
		return "", fmt.Errorf("marshal enroll request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+enrollPath, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create enroll request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("send enroll request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read enroll response: %w", err)
	}

	if resp.StatusCode >= http.StatusBadRequest {
		return "", fmt.Errorf("enroll failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var parsed enrollResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("decode enroll response: %w", err)
	}

	if parsed.AuthToken == "" {
		return "", fmt.Errorf("enroll response missing auth_token")
	}

	return parsed.AuthToken, nil
}

// SendInventory posts device inventory to the MDM server.
func (c *APIClient) SendInventory(authToken, hwid string, info *system.DeviceInfo) error {
	payload, err := json.Marshal(info)
	if err != nil {
		return fmt.Errorf("marshal inventory: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+inventoryPath, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create inventory request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send inventory request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read inventory response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusCreated, http.StatusAccepted, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("inventory failed with HTTP %d", resp.StatusCode)
	}
}

// PollCommand fetches the next pending remote command for this device.
func (c *APIClient) PollCommand(authToken, hwid string) (*PendingCommand, error) {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+pollCommandPath, nil)
	if err != nil {
		return nil, fmt.Errorf("create poll request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send poll request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return nil, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read poll response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return nil, ErrUnauthorized
	case http.StatusOK:
		var parsed pendingCommandResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, fmt.Errorf("decode poll response: %w", err)
		}
		return &PendingCommand{
			ID:      parsed.ID,
			Action:  parsed.Action,
			Payload: parsed.Payload,
		}, nil
	default:
		return nil, fmt.Errorf("poll failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
}

// CompleteCommand reports command execution outcome back to the server.
func (c *APIClient) CompleteCommand(authToken, hwid string, commandID uint, success bool, message string) error {
	payload, err := json.Marshal(completeCommandRequest{
		Success: success,
		Message: message,
	})
	if err != nil {
		return fmt.Errorf("marshal complete request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(completeCommandPath, commandID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create complete request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send complete request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read complete response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("complete failed with HTTP %d", resp.StatusCode)
	}
}
