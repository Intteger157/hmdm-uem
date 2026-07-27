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
	localGroupActionAdd = "add"
	localGroupActionRemove = "remove"

	localGroupMDMAppliedOutput = "Group policy successfully applied"
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
	_ = output

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

func runLocalGroupMember(action, groupName, userName string) (string, error) {
	groupName = normalizeNetLocalGroupPrincipal(groupName)
	userName = normalizeNetLocalGroupPrincipal(userName)

	script := buildLocalGroupMDMScript(buildLocalGroupXMLPayload(action, groupName, userName))
	cmd := newLocalGroupMemberCommand(script)
	output, err := cmd.CombinedOutput()
	combined := strings.TrimSpace(string(output))
	if err != nil {
		log.Printf("manage_local_group failed: action=%s group=%q user=%q: %v (%s)", action, groupName, userName, err, combined)
		if combined != "" {
			return combined, fmt.Errorf("%s", combined)
		}
		return "", err
	}
	return combined, nil
}

func buildLocalGroupXMLPayload(action, groupName, userName string) string {
	group := escapeXMLAttribute(groupName)
	member := escapeXMLAttribute(userName)
	if action == localGroupActionRemove {
		return fmt.Sprintf(`<GroupConfiguration><accessgroup desc="%s"><group action="U"/><remove member="%s"/></accessgroup></GroupConfiguration>`, group, member)
	}
	return fmt.Sprintf(`<GroupConfiguration><accessgroup desc="%s"><group action="U"/><add member="%s"/></accessgroup></GroupConfiguration>`, group, member)
}

func buildLocalGroupMDMScript(xmlPayload string) string {
	return fmt.Sprintf(
		"try { $xml = '%s'; $namespace = 'ROOT\\CIMv2\\mdm\\dmmap'; $className = 'MDM_Policy_Config01_LocalUsersAndGroups02'; $filter = \"InstanceID='LocalUsersAndGroups' and ParentID='./Vendor/MSFT/Policy/Config'\"; $instance = Get-CimInstance -Namespace $namespace -ClassName $className -Filter $filter -ErrorAction SilentlyContinue; if ($instance) { $instance.Configure = $xml; Set-CimInstance -InputObject $instance -ErrorAction Stop } else { New-CimInstance -Namespace $namespace -ClassName $className -Property @{ParentID='./Vendor/MSFT/Policy/Config'; InstanceID='LocalUsersAndGroups'; Configure=$xml} -ErrorAction Stop }; Write-Output '%s' } catch { throw $_ }",
		escapePowerShellSingleQuoted(xmlPayload),
		localGroupMDMAppliedOutput,
	)
}

func newLocalGroupMemberCommand(script string) *exec.Cmd {
	cmd := exec.Command("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd
}

func escapeXMLAttribute(value string) string {
	value = strings.ReplaceAll(value, "&", "&amp;")
	value = strings.ReplaceAll(value, `"`, "&quot;")
	value = strings.ReplaceAll(value, "<", "&lt;")
	value = strings.ReplaceAll(value, ">", "&gt;")
	return value
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
