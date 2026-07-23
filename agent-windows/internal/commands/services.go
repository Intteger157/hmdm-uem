//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"syscall"
)

type serviceEntry struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}

type restartServicePayload struct {
	ServiceName string `json:"service_name"`
}

func getServices() Result {
	script := `Get-Service | Select-Object Name, DisplayName, Status | ConvertTo-Json -Compress`
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("get services failed: %v (%s)", err, strings.TrimSpace(string(output)))}
	}

	entries, err := parseServiceEntries(output)
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("parse services failed: %v", err)}
	}

	encoded, err := json.Marshal(entries)
	if err != nil {
		return Result{Success: false, Message: fmt.Sprintf("encode services failed: %v", err)}
	}
	return Result{Success: true, Message: string(encoded)}
}

func restartService(payload json.RawMessage) Result {
	var parsed restartServicePayload
	if err := json.Unmarshal(payload, &parsed); err != nil {
		return Result{Success: false, Message: fmt.Sprintf("invalid restart_service payload: %v", err)}
	}

	serviceName := strings.TrimSpace(parsed.ServiceName)
	if serviceName == "" {
		return Result{Success: false, Message: "service_name is required"}
	}

	script := fmt.Sprintf(
		"Restart-Service -Name '%s' -Force -ErrorAction Stop",
		escapePowerShellSingleQuoted(serviceName),
	)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	message := strings.TrimSpace(string(output))
	if err != nil {
		if message == "" {
			message = err.Error()
		}
		return Result{Success: false, Message: fmt.Sprintf("restart service failed: %s", message)}
	}
	if message == "" {
		message = fmt.Sprintf("service %s restarted", serviceName)
	}
	return Result{Success: true, Message: message}
}

func parseServiceEntries(raw []byte) ([]serviceEntry, error) {
	text := strings.TrimSpace(string(raw))
	if text == "" {
		return nil, fmt.Errorf("empty service list")
	}

	if strings.HasPrefix(text, "[") {
		var batch []struct {
			Name        string `json:"Name"`
			DisplayName string `json:"DisplayName"`
			Status      int    `json:"Status"`
		}
		if err := json.Unmarshal(raw, &batch); err != nil {
			return nil, err
		}
		entries := make([]serviceEntry, 0, len(batch))
		for _, item := range batch {
			entries = append(entries, serviceEntry{
				Name:        strings.TrimSpace(item.Name),
				DisplayName: strings.TrimSpace(item.DisplayName),
				Status:      mapServiceStatus(item.Status),
			})
		}
		return entries, nil
	}

	var single struct {
		Name        string `json:"Name"`
		DisplayName string `json:"DisplayName"`
		Status      int    `json:"Status"`
	}
	if err := json.Unmarshal(raw, &single); err != nil {
		return nil, err
	}
	return []serviceEntry{{
		Name:        strings.TrimSpace(single.Name),
		DisplayName: strings.TrimSpace(single.DisplayName),
		Status:      mapServiceStatus(single.Status),
	}}, nil
}

func mapServiceStatus(status int) string {
	switch status {
	case 4:
		return "running"
	default:
		return "stopped"
	}
}
