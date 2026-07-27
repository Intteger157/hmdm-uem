//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"syscall"
)

type manageLocalGroupPayload struct {
	Username string `json:"username"`
	Group    string `json:"group"`
	Action   string `json:"action"`
}

const (
	localGroupActionAdd    = "add"
	localGroupActionRemove = "remove"
)

func manageLocalGroup(payload json.RawMessage) Result {
	parsed, err := parseManageLocalGroupPayload(payload)
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}

	output, err := runNetLocalGroup(parsed.Action, parsed.Group, parsed.Username)
	if err != nil {
		message := strings.TrimSpace(output)
		if message == "" {
			message = err.Error()
		}
		return Result{Success: false, Message: message}
	}

	result := Result{
		Success: true,
		Message: manageLocalGroupSuccessMessage(parsed.Username, parsed.Group, parsed.Action),
	}

	if syncResult := executeSyncInventory(); !syncResult.Success && strings.TrimSpace(syncResult.Message) != "" {
		result.Message += "\nInventory sync: " + syncResult.Message
	}

	return result
}

func manageLocalGroupFromString(payload string) Result {
	payload = strings.TrimSpace(payload)
	if payload == "" {
		return Result{Success: false, Message: "manage_local_group payload is empty"}
	}
	return manageLocalGroup(json.RawMessage(payload))
}

func parseManageLocalGroupPayload(payload json.RawMessage) (manageLocalGroupPayload, error) {
	if len(payload) == 0 {
		return manageLocalGroupPayload{}, fmt.Errorf("manage_local_group payload is empty")
	}

	var parsed manageLocalGroupPayload
	if err := json.Unmarshal(payload, &parsed); err != nil {
		var asString string
		if err := json.Unmarshal(payload, &asString); err != nil {
			return manageLocalGroupPayload{}, fmt.Errorf("invalid manage_local_group payload: %v", err)
		}
		return parseManageLocalGroupPayload(json.RawMessage(strings.TrimSpace(asString)))
	}

	parsed.Username = normalizeNetLocalGroupPrincipal(parsed.Username)
	parsed.Group = normalizeNetLocalGroupPrincipal(parsed.Group)
	parsed.Action = strings.ToLower(strings.TrimSpace(parsed.Action))

	if parsed.Username == "" {
		return manageLocalGroupPayload{}, fmt.Errorf("username is required")
	}
	if parsed.Group == "" {
		return manageLocalGroupPayload{}, fmt.Errorf("group is required")
	}
	switch parsed.Action {
	case localGroupActionAdd, localGroupActionRemove:
	default:
		return manageLocalGroupPayload{}, fmt.Errorf("action must be add or remove")
	}
	return parsed, nil
}

func runNetLocalGroup(action, groupName, userName string) (string, error) {
	flag := "/add"
	if action == localGroupActionRemove {
		flag = "/delete"
	}

	groupName = normalizeNetLocalGroupPrincipal(groupName)
	userName = normalizeNetLocalGroupPrincipal(userName)

	// Pass group and user as single argv entries so domain names like AzureAD\user@domain.com stay intact.
	cmd := exec.Command("net", "localgroup", groupName, userName, flag)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	combined := strings.TrimSpace(string(output))
	if err != nil {
		if combined != "" {
			return combined, fmt.Errorf("%s", combined)
		}
		return "", err
	}
	return combined, nil
}

func normalizeNetLocalGroupPrincipal(value string) string {
	return strings.TrimSpace(value)
}

func manageLocalGroupSuccessMessage(username, group, action string) string {
	if action == localGroupActionRemove {
		return fmt.Sprintf("User %s successfully removed from group %s", username, group)
	}
	return fmt.Sprintf("User %s successfully added to group %s", username, group)
}
