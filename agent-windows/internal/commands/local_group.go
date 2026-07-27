//go:build windows

package commands

import (
	"encoding/json"
	"fmt"
	"log"
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

	localGroupAlreadyAppliedOutput = "Action already applied"
)

func manageLocalGroup(payload json.RawMessage) Result {
	parsed, err := parseManageLocalGroupPayload(payload)
	if err != nil {
		return Result{Success: false, Message: err.Error()}
	}

	output, err := runLocalGroupMember(parsed.Action, parsed.Group, parsed.Username)
	if err != nil {
		message := strings.TrimSpace(output)
		if message == "" {
			message = err.Error()
		}
		return Result{Success: false, Message: message}
	}

	result := Result{
		Success: true,
		Message: manageLocalGroupResultMessage(parsed.Username, parsed.Group, parsed.Action, output),
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

func runLocalGroupMember(action, groupName, userName string) (string, error) {
	groupName = normalizeNetLocalGroupPrincipal(groupName)
	userName = normalizeNetLocalGroupPrincipal(userName)

	script := buildLocalGroupMemberScript(action, groupName, userName)
	stdout, stderr, err := runPowerShellScript(script)
	combined := strings.TrimSpace(stderr)
	if combined == "" {
		combined = strings.TrimSpace(stdout)
	}
	if err != nil {
		log.Printf("manage_local_group failed: action=%s group=%q user=%q: %v (%s)", action, groupName, userName, err, combined)
		if combined != "" {
			return combined, fmt.Errorf("%s", combined)
		}
		return "", err
	}
	return combined, nil
}

func buildLocalGroupMemberScript(action, groupName, userName string) string {
	group := escapePowerShellSingleQuoted(groupName)
	member := escapePowerShellSingleQuoted(userName)
	actionLiteral := escapePowerShellSingleQuoted(action)
	return fmt.Sprintf(
		"try { $sid = (New-Object System.Security.Principal.NTAccount('%s')).Translate([System.Security.Principal.SecurityIdentifier]).Value; if ('%s' -eq 'add') { Add-LocalGroupMember -Group '%s' -Member $sid -ErrorAction Stop } else { Remove-LocalGroupMember -Group '%s' -Member $sid -ErrorAction Stop } } catch { if ($_.FullyQualifiedErrorId -match 'MemberExists|MemberNotFound') { Write-Output '%s'; exit 0 } else { throw $_ } }",
		member,
		actionLiteral,
		group,
		group,
		localGroupAlreadyAppliedOutput,
	)
}

func newLocalGroupMemberCommand(action, groupName, userName string) *exec.Cmd {
	script := buildLocalGroupMemberScript(action, groupName, userName)
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

func normalizeNetLocalGroupPrincipal(value string) string {
	return strings.TrimSpace(value)
}

func manageLocalGroupResultMessage(username, group, action, output string) string {
	if isLocalGroupAlreadyApplied(output) {
		return manageLocalGroupAlreadyAppliedMessage(action)
	}
	return manageLocalGroupSuccessMessage(username, group, action)
}

func isLocalGroupAlreadyApplied(output string) bool {
	return strings.TrimSpace(output) == localGroupAlreadyAppliedOutput
}

func manageLocalGroupAlreadyAppliedMessage(action string) string {
	if action == localGroupActionRemove {
		return "User was not found in the group (already removed)."
	}
	return "User is already a member of the group."
}

func manageLocalGroupSuccessMessage(username, group, action string) string {
	if action == localGroupActionRemove {
		return fmt.Sprintf("User %s successfully removed from group %s", username, group)
	}
	return fmt.Sprintf("User %s successfully added to group %s", username, group)
}
