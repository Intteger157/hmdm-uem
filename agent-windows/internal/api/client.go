// Package api provides HTTP communication with the Headwind MDM server.
package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/system"
)

const (
	enrollPath                = "/rest/windows/enroll"
	inventoryPath             = "/rest/windows/inventory"
	uninstallPath             = "/rest/windows/uninstall"
	pollCommandPath           = "/rest/windows/commands/poll"
	completeCommandPath       = "/rest/windows/commands/%d/complete"
	submitCommandResultPath   = "/rest/windows/commands/%d/result"
	effectiveConfigPath       = "/rest/windows/devices/%s/effective-config"
	policyEnforcementLogPath  = "/rest/windows/devices/%s/policy-enforcement"
	appStatusPath             = "/rest/windows/devices/%s/apps/status"
)

// ErrUnauthorized indicates the server rejected the current auth token.
var ErrUnauthorized = errors.New("unauthorized")

// ErrNoEffectivePolicy indicates the device has no assigned configuration profile.
var ErrNoEffectivePolicy = errors.New("no effective policy")

// ErrDeviceNotFound indicates the device record was removed from the server.
var ErrDeviceNotFound = errors.New("device not found")

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

type inventorySyncResponse struct {
	Commands []pendingDeviceCommandResponse `json:"commands"`
}

type pendingDeviceCommandResponse struct {
	ID          uint   `json:"id"`
	CommandName string `json:"commandName"`
	Payload     string `json:"payload"`
}

type submitCommandResultRequest struct {
	Status string `json:"status"`
	Output string `json:"output"`
}

// PendingCommand describes a command fetched from the server poll queue.
type PendingCommand struct {
	ID      uint
	Action  string
	Payload json.RawMessage
}

// PendingDeviceCommand is a command delivered during inventory check-in.
type PendingDeviceCommand struct {
	ID          uint
	CommandName string
	Payload     string
}

// EffectiveConfigPayload is the merged policy payload for a Windows device.
type EffectiveConfigPayload struct {
	DefenderEnabled   bool `json:"defenderEnabled"`
	BlockUsbStorage   bool `json:"blockUsbStorage"`
	UsbReadOnly       bool `json:"usbReadOnly"`
	ScreenLockTimeout int  `json:"screenLockTimeout"`
}

// RequiredAppPayload is one app required by effective configuration.
type RequiredAppPayload struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl"`
	InstallArgs string `json:"installArgs"`
}

// EffectiveConfigResponse is returned by GET /rest/windows/devices/:id/effective-config.
type EffectiveConfigResponse struct {
	Payload      EffectiveConfigPayload `json:"payload"`
	RequiredApps []RequiredAppPayload   `json:"requiredApps"`
	ProfileID    uint                   `json:"profileId,omitempty"`
	ProfileName  string                 `json:"profileName,omitempty"`
	Source       string                 `json:"source,omitempty"`
}

// IsEmptyEffectiveConfig reports whether the server returned no assigned profile/policy.
func IsEmptyEffectiveConfig(response EffectiveConfigResponse) bool {
	if response.ProfileID > 0 {
		return false
	}
	if strings.TrimSpace(response.ProfileName) != "" {
		return false
	}
	if strings.TrimSpace(response.Source) != "" {
		return false
	}
	return len(response.RequiredApps) == 0
}
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

// SendInventory posts device inventory to the MDM server and returns pending commands.
func (c *APIClient) SendInventory(authToken, hwid string, info *system.DeviceInfo) ([]PendingDeviceCommand, error) {
	payload, err := json.Marshal(info)
	if err != nil {
		return nil, fmt.Errorf("marshal inventory: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+inventoryPath, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create inventory request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send inventory request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read inventory response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return nil, ErrUnauthorized
	case http.StatusNotFound:
		return nil, ErrDeviceNotFound
	case http.StatusOK, http.StatusCreated, http.StatusAccepted, http.StatusNoContent:
		if len(body) == 0 {
			return nil, nil
		}
		var parsed inventorySyncResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, fmt.Errorf("decode inventory response: %w", err)
		}
		commands := make([]PendingDeviceCommand, 0, len(parsed.Commands))
		for _, item := range parsed.Commands {
			commands = append(commands, PendingDeviceCommand{
				ID:          item.ID,
				CommandName: item.CommandName,
				Payload:     item.Payload,
			})
		}
		return commands, nil
	default:
		return nil, fmt.Errorf("inventory failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
}

// NotifyUninstall tells the MDM server the agent is being removed from this PC.
func (c *APIClient) NotifyUninstall(authToken, hwid string) error {
	req, err := http.NewRequest(http.MethodPost, c.baseURL+uninstallPath, http.NoBody)
	if err != nil {
		return fmt.Errorf("create uninstall request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send uninstall request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read uninstall response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("uninstall notify failed with HTTP %d", resp.StatusCode)
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
	case http.StatusNotFound:
		return nil, ErrDeviceNotFound
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

// SubmitCommandResult reports DeviceCommandLog execution output back to the server.
func (c *APIClient) SubmitCommandResult(authToken, hwid string, commandID uint, success bool, output string) error {
	status := "Failed"
	if success {
		status = "Success"
	}

	payload, err := json.Marshal(submitCommandResultRequest{
		Status: status,
		Output: output,
	})
	if err != nil {
		return fmt.Errorf("marshal command result: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(submitCommandResultPath, commandID)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create command result request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send command result request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read command result response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("command result failed with HTTP %d", resp.StatusCode)
	}
}

// FetchEffectiveConfig returns the merged effective policy for this device.
func (c *APIClient) FetchEffectiveConfig(authToken, hwid string) (EffectiveConfigResponse, error) {
	url := c.baseURL + fmt.Sprintf(effectiveConfigPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return EffectiveConfigResponse{}, fmt.Errorf("create effective-config request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return EffectiveConfigResponse{}, fmt.Errorf("send effective-config request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return EffectiveConfigResponse{}, fmt.Errorf("read effective-config response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return EffectiveConfigResponse{}, ErrUnauthorized
	case http.StatusNotFound:
		return EffectiveConfigResponse{}, ErrDeviceNotFound
	case http.StatusNoContent:
		return EffectiveConfigResponse{}, ErrNoEffectivePolicy
	case http.StatusOK:
		trimmedBody := strings.TrimSpace(string(body))
		if trimmedBody == "" || trimmedBody == "{}" || trimmedBody == "null" {
			return EffectiveConfigResponse{}, ErrNoEffectivePolicy
		}

		var parsed EffectiveConfigResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return EffectiveConfigResponse{}, fmt.Errorf("decode effective-config response: %w", err)
		}
		if IsEmptyEffectiveConfig(parsed) {
			return EffectiveConfigResponse{}, ErrNoEffectivePolicy
		}
		return parsed, nil
	default:
		return EffectiveConfigResponse{}, fmt.Errorf("effective-config failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
}

// ReportPolicyEnforcement uploads policy enforcement output to Action Logs.
func (c *APIClient) ReportPolicyEnforcement(authToken, hwid string, success bool, output string) error {
	payload, err := json.Marshal(map[string]any{
		"success": success,
		"output":  output,
	})
	if err != nil {
		return fmt.Errorf("marshal policy enforcement request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(policyEnforcementLogPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create policy enforcement request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send policy enforcement request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read policy enforcement response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("policy enforcement log failed with HTTP %d", resp.StatusCode)
	}
}

// ReportAppStatus uploads app deployment progress for one required app.
func (c *APIClient) ReportAppStatus(authToken, hwid string, appID uint, status, errMsg string) error {
	payload, err := json.Marshal(map[string]any{
		"appId":  appID,
		"status": status,
		"error":  errMsg,
	})
	if err != nil {
		return fmt.Errorf("marshal app status request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(appStatusPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create app status request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send app status request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read app status response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("app status report failed with HTTP %d", resp.StatusCode)
	}
}
