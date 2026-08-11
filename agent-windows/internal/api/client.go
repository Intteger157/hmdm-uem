// Package api provides HTTP communication with the Singularity MDM server.
package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/system"
)

const (
	checkinPath               = "/rest/windows/checkin"
	enrollPath                = "/rest/windows/enroll"
	inventoryPath             = "/rest/windows/inventory"
	uninstallPath             = "/rest/windows/uninstall"
	pollCommandPath           = "/rest/windows/commands/poll"
	completeCommandPath       = "/rest/windows/commands/%d/complete"
	submitCommandResultPath   = "/rest/windows/commands/%d/result"
	effectiveConfigPath       = "/rest/windows/devices/%s/effective-config"
	deviceConfigurationsPath  = "/rest/windows/devices/%s/configurations"
	policyEnforcementLogPath  = "/rest/windows/devices/%s/policy-enforcement"
	bitlockerKeyPath          = "/rest/windows/devices/%s/bitlocker-key"
	appStatusPath             = "/rest/windows/devices/%s/apps/status"
	appInstallLogPath         = "/rest/windows/devices/%s/logs/app-install"
	fileDeploymentLogPath     = "/rest/windows/devices/%s/logs/file-deployment"
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

// CheckinResponse is returned by POST /rest/windows/checkin.
type CheckinResponse struct {
	ConfigHash    string `json:"configHash"`
	ConfigChanged bool   `json:"configChanged"`
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
	RequireBitLocker  bool `json:"requireBitLocker"`
}

// RequiredAppPayload is one app required by effective configuration.
type RequiredAppPayload struct {
	ID              uint   `json:"id"`
	VersionID       uint   `json:"versionId,omitempty"`
	Name            string `json:"name"`
	Version         string `json:"version"`
	ExpectedVersion string `json:"expectedVersion,omitempty"`
	VersionPolicy   string `json:"versionPolicy,omitempty"`
	UpdatedAt       string `json:"updatedAt"`
	DownloadURL     string `json:"downloadUrl"`
	InstallArgs     string `json:"installArgs"`
	AppType         string `json:"appType"`
	WingetID        string `json:"wingetId"`
	AutoUpdate      bool   `json:"autoUpdate"`
	UpdateFrequency string `json:"updateFrequency"`
}

// FileDeploymentPayload is one file deployment rule from effective configuration.
type FileDeploymentPayload struct {
	ID               uint   `json:"id"`
	FileID           uint   `json:"fileId"`
	OriginalName     string `json:"originalName"`
	DownloadURL      string `json:"downloadUrl"`
	SizeBytes        int64  `json:"sizeBytes"`
	SHA256           string `json:"sha256"`
	DestinationPath  string `json:"destinationPath"`
	Unzip            bool   `json:"unzip"`
	PostActionScript string `json:"postActionScript"`
	UpdatedAt        string `json:"updatedAt"`
}

// AppliedProfilePayload describes one profile that contributed to effective policy.
type AppliedProfilePayload struct {
	ProfileID   uint   `json:"profileId"`
	ProfileName string `json:"profileName"`
	Source      string `json:"source"`
	UpdatedAt   string `json:"updatedAt,omitempty"`
}

// EffectiveConfigResponse is returned by GET /rest/windows/devices/:id/effective-config.
type EffectiveConfigResponse struct {
	Payload         EffectiveConfigPayload    `json:"payload"`
	RequiredApps    []RequiredAppPayload      `json:"requiredApps"`
	FileDeployments []FileDeploymentPayload   `json:"fileDeployments"`
	ProfileID       uint                      `json:"profileId,omitempty"`
	ProfileName     string                    `json:"profileName,omitempty"`
	Source          string                    `json:"source,omitempty"`
	AppliedProfiles []AppliedProfilePayload   `json:"appliedProfiles,omitempty"`
}

// DeviceConfigurationsResponse is returned by GET /rest/windows/devices/:id/configurations.
type DeviceConfigurationsResponse struct {
	ConfigurationID   uint                         `json:"configurationId,omitempty"`
	ConfigurationName string                       `json:"configurationName,omitempty"`
	Policies          []ConfigurationPolicyPayload `json:"policies"`
}

// ConfigurationPolicyPayload is one registry policy rule for the agent.
type ConfigurationPolicyPayload struct {
	ID         uint   `json:"id,omitempty"`
	PolicyPath string `json:"policyPath"`
	ValueType  string `json:"valueType"`
	Value      string `json:"value"`
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
	return len(response.RequiredApps) == 0 && len(response.FileDeployments) == 0
}
func NewAPIClient(cfg config.Config) *APIClient {
	return &APIClient{
		baseURL: strings.TrimRight(cfg.ServerURL, "/"),
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

// BaseURL returns the configured MDM server URL without a trailing slash.
func (c *APIClient) BaseURL() string {
	if c == nil {
		return ""
	}
	return c.baseURL
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

// SendCheckin updates server-side presence without uploading full inventory.
func (c *APIClient) SendCheckin(authToken, hwid, configHash string) (CheckinResponse, error) {
	req, err := http.NewRequest(http.MethodPost, c.baseURL+checkinPath, http.NoBody)
	if err != nil {
		return CheckinResponse{}, fmt.Errorf("create checkin request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)
	if trimmedHash := strings.TrimSpace(configHash); trimmedHash != "" {
		req.Header.Set("X-Config-Hash", trimmedHash)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return CheckinResponse{}, fmt.Errorf("send checkin request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return CheckinResponse{}, fmt.Errorf("read checkin response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return CheckinResponse{}, ErrUnauthorized
	case http.StatusNotFound:
		return CheckinResponse{}, ErrDeviceNotFound
	case http.StatusOK:
		var parsed CheckinResponse
		if len(body) > 0 {
			if err := json.Unmarshal(body, &parsed); err != nil {
				log.Printf(
					"checkin: decode response failed (heartbeat continues): %v body=%q",
					err,
					truncateBodyForLog(body, 512),
				)
				return CheckinResponse{}, nil
			}
		}
		return parsed, nil
	case http.StatusNoContent:
		return CheckinResponse{}, nil
	default:
		return CheckinResponse{}, fmt.Errorf("checkin failed with HTTP %d", resp.StatusCode)
	}
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
			log.Printf(
				"inventory: decode response failed (continuing cycle): %v body=%q",
				err,
				truncateBodyForLog(body, 512),
			)
			return nil, nil
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
			log.Printf(
				"effective-config: decode response failed: %v body=%q",
				err,
				truncateBodyForLog(body, 512),
			)
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

// FetchDeviceConfigurations returns merged registry policies assigned to this device.
func (c *APIClient) FetchDeviceConfigurations(authToken, hwid string) (DeviceConfigurationsResponse, error) {
	url := c.baseURL + fmt.Sprintf(deviceConfigurationsPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return DeviceConfigurationsResponse{}, fmt.Errorf("create configurations request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return DeviceConfigurationsResponse{}, fmt.Errorf("send configurations request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return DeviceConfigurationsResponse{}, fmt.Errorf("read configurations response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return DeviceConfigurationsResponse{}, ErrUnauthorized
	case http.StatusNotFound:
		return DeviceConfigurationsResponse{}, ErrDeviceNotFound
	case http.StatusNoContent:
		return DeviceConfigurationsResponse{}, nil
	case http.StatusOK:
		trimmedBody := strings.TrimSpace(string(body))
		if trimmedBody == "" || trimmedBody == "{}" || trimmedBody == "null" {
			return DeviceConfigurationsResponse{}, nil
		}

		var parsed DeviceConfigurationsResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			log.Printf(
				"configurations: decode response failed (continuing sync): %v body=%q",
				err,
				truncateBodyForLog(body, 512),
			)
			return DeviceConfigurationsResponse{}, nil
		}
		return parsed, nil
	default:
		return DeviceConfigurationsResponse{}, fmt.Errorf("configurations failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
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

// SubmitBitLockerKey uploads a BitLocker recovery password for escrow on the MDM server.
func (c *APIClient) SubmitBitLockerKey(authToken, hwid, recoveryKey string) error {
	payload, err := json.Marshal(map[string]string{
		"recoveryKey": recoveryKey,
	})
	if err != nil {
		return fmt.Errorf("marshal bitlocker key request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(bitlockerKeyPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create bitlocker key request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send bitlocker key request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read bitlocker key response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("bitlocker key upload failed with HTTP %d", resp.StatusCode)
	}
}

// ReportAppInstallLog uploads app deployment progress to Action Logs.
func (c *APIClient) ReportAppInstallLog(authToken, hwid string, appID uint, appName, status, output string) error {
	payload, err := json.Marshal(map[string]any{
		"appId":   appID,
		"appName": appName,
		"status":  status,
		"output":  output,
	})
	if err != nil {
		return fmt.Errorf("marshal app install log request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(appInstallLogPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create app install log request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send app install log request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read app install log response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("app install log failed with HTTP %d", resp.StatusCode)
	}
}

// ReportFileDeploymentLog uploads file deployment progress to Action Logs.
func (c *APIClient) ReportFileDeploymentLog(authToken, hwid string, deploymentID, fileID uint, fileName, status, output string) error {
	payload, err := json.Marshal(map[string]any{
		"deploymentId": deploymentID,
		"fileId":       fileID,
		"fileName":     fileName,
		"status":       status,
		"output":       output,
	})
	if err != nil {
		return fmt.Errorf("marshal file deployment log request: %w", err)
	}

	url := c.baseURL + fmt.Sprintf(fileDeploymentLogPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create file deployment log request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send file deployment log request: %w", err)
	}
	defer resp.Body.Close()

	if _, err := io.Copy(io.Discard, resp.Body); err != nil {
		return fmt.Errorf("read file deployment log response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return ErrUnauthorized
	case http.StatusOK, http.StatusNoContent:
		return nil
	default:
		return fmt.Errorf("file deployment log failed with HTTP %d", resp.StatusCode)
	}
}

// DeviceAppStatusItem is one app deployment status from the server.
type DeviceAppStatusItem struct {
	AppID   uint   `json:"appId"`
	AppName string `json:"appName"`
	Status  string `json:"status"`
}

type deviceAppStatusListResponse struct {
	Items []DeviceAppStatusItem `json:"items"`
}

// FetchDeviceAppStatuses returns current deployment statuses for this device.
func (c *APIClient) FetchDeviceAppStatuses(authToken, hwid string) ([]DeviceAppStatusItem, error) {
	url := c.baseURL + fmt.Sprintf(appStatusPath, url.PathEscape(hwid))
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create app status list request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+authToken)
	req.Header.Set("X-Device-Id", hwid)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send app status list request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read app status list response: %w", err)
	}

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		return nil, ErrUnauthorized
	case http.StatusNotFound:
		return nil, ErrDeviceNotFound
	case http.StatusOK:
		var parsed deviceAppStatusListResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			log.Printf(
				"app status list: decode response failed: %v body=%q",
				err,
				truncateBodyForLog(body, 512),
			)
			return nil, fmt.Errorf("decode app status list response: %w", err)
		}
		return parsed.Items, nil
	default:
		return nil, fmt.Errorf("app status list failed with HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
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

func truncateBodyForLog(body []byte, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 512
	}
	trimmed := strings.TrimSpace(string(body))
	if len(trimmed) <= maxLen {
		return trimmed
	}
	return trimmed[:maxLen] + "..."
}
