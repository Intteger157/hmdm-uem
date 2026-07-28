//go:build windows

package commands

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParseManageLocalGroupPayloadPreservesDomainUsername(t *testing.T) {
	t.Parallel()

	payload, err := parseManageLocalGroupPayload(json.RawMessage(`{"username":"AzureAD\\user@example.com","group":"Administrators","action":"add"}`))
	if err != nil {
		t.Fatalf("parseManageLocalGroupPayload() error = %v", err)
	}
	if payload.Username != `AzureAD\user@example.com` {
		t.Fatalf("username = %q", payload.Username)
	}
}

func TestBuildLocalGroupRawXMLAdd(t *testing.T) {
	t.Parallel()

	xmlPayload := buildLocalGroupRawXML(localGroupActionAdd, `AzureAD\user@example.com`)
	want := `<GroupConfiguration><accessgroup desc="S-1-5-32-544"><group action="U"/><add member="AzureAD\user@example.com"/></accessgroup></GroupConfiguration>`
	if xmlPayload != want {
		t.Fatalf("xmlPayload = %q, want %q", xmlPayload, want)
	}
}

func TestBuildLocalGroupRawXMLRemove(t *testing.T) {
	t.Parallel()

	xmlPayload := buildLocalGroupRawXML(localGroupActionRemove, "alice")
	want := `<GroupConfiguration><accessgroup desc="S-1-5-32-544"><group action="U"/><remove member="alice"/></accessgroup></GroupConfiguration>`
	if xmlPayload != want {
		t.Fatalf("xmlPayload = %q, want %q", xmlPayload, want)
	}
}

func TestBuildLocalGroupRawXMLUsesRawMemberName(t *testing.T) {
	t.Parallel()

	xmlPayload := buildLocalGroupRawXML(localGroupActionAdd, `user&name"test`)
	if !strings.Contains(xmlPayload, `member="user&name"test"`) {
		t.Fatalf("xmlPayload = %q, expected raw username without XML escaping", xmlPayload)
	}
}

func TestLocalGroupMemberCommandUsesMDMWMI(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMDMScript(localGroupActionAdd, `AzureAD\user@example.com`)
	cmd := newLocalGroupMemberCommand(script)
	if len(cmd.Args) < 4 {
		t.Fatalf("args = %#v", cmd.Args)
	}
	if cmd.Args[0] != "powershell.exe" {
		t.Fatalf("executable = %q, want powershell.exe", cmd.Args[0])
	}
	commandScript := cmd.Args[len(cmd.Args)-1]
	if !strings.Contains(commandScript, "MDM_Policy_Config01_LocalUsersAndGroups02") {
		t.Fatalf("script = %q, expected LocalUsersAndGroups MDM class", commandScript)
	}
	if !strings.Contains(commandScript, "InstanceID='Configure' and ParentID='./Vendor/MSFT/Policy/Config/LocalUsersAndGroups'") {
		t.Fatalf("script = %q, expected Configure instance under LocalUsersAndGroups policy path", commandScript)
	}
	if !strings.Contains(commandScript, "ParentID='./Vendor/MSFT/Policy/Config/LocalUsersAndGroups'; InstanceID='Configure'") {
		t.Fatalf("script = %q, expected corrected New-CimInstance hierarchy", commandScript)
	}
	if !strings.Contains(commandScript, "Get-CimInstance -Namespace $namespace -ClassName $className -Filter $filter") {
		t.Fatalf("script = %q, expected Get-CimInstance with MDM filter", commandScript)
	}
	if !strings.Contains(commandScript, "Set-CimInstance -InputObject $instance") || !strings.Contains(commandScript, "New-CimInstance -Namespace $namespace") {
		t.Fatalf("script = %q, expected Set-CimInstance or New-CimInstance", commandScript)
	}
	if strings.Contains(commandScript, "Get-LocalGroupMember") || strings.Contains(commandScript, "net localgroup") || strings.Contains(commandScript, "Add-LocalGroupMember") {
		t.Fatalf("script = %q, should not use legacy group management commands", commandScript)
	}
	if !strings.Contains(commandScript, `desc="S-1-5-32-544"`) {
		t.Fatalf("script = %q, expected Administrators SID in XML payload", commandScript)
	}
	if !strings.Contains(commandScript, "[System.Security.SecurityElement]::Escape($rawXml)") {
		t.Fatalf("script = %q, expected SecurityElement XML escape", commandScript)
	}
	if !strings.Contains(commandScript, "$instance.Configure = $escapedXml") {
		t.Fatalf("script = %q, expected escaped XML assigned to Configure", commandScript)
	}
	if strings.Contains(commandScript, "$instance.Configure = $rawXml") {
		t.Fatalf("script = %q, should not assign raw XML directly to Configure", commandScript)
	}
	if !strings.Contains(commandScript, localGroupMDMAppliedOutput) {
		t.Fatalf("script = %q, expected MDM Bridge success marker", commandScript)
	}
	if !strings.Contains(commandScript, `$rawXml = '`) {
		t.Fatalf("script = %q, expected raw XML embedded for escaping", commandScript)
	}
	if !strings.Contains(commandScript, `<add member="AzureAD\user@example.com"/>`) {
		t.Fatalf("script = %q, expected XML payload embedded in script", commandScript)
	}
}

func TestBuildLocalGroupMDMScriptEscapesSingleQuotes(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMDMScript(localGroupActionAdd, "user'@example.com")
	if !strings.Contains(script, "user''@example.com") {
		t.Fatalf("script = %q, expected escaped single quote for PowerShell string", script)
	}
}

func TestParseManageLocalGroupPayload(t *testing.T) {
	t.Parallel()

	payload, err := parseManageLocalGroupPayload(json.RawMessage(`{"username":"alice","group":"Administrators","action":"add"}`))
	if err != nil {
		t.Fatalf("parseManageLocalGroupPayload() error = %v", err)
	}
	if payload.Username != "alice" || payload.Group != "Administrators" || payload.Action != "add" {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestParseManageLocalGroupPayloadRequiresFields(t *testing.T) {
	t.Parallel()

	_, err := parseManageLocalGroupPayload(json.RawMessage(`{"group":"Administrators","action":"add"}`))
	if err == nil || !strings.Contains(err.Error(), "username") {
		t.Fatalf("expected username error, got %v", err)
	}

	_, err = parseManageLocalGroupPayload(json.RawMessage(`{"username":"alice","action":"add"}`))
	if err == nil || !strings.Contains(err.Error(), "group") {
		t.Fatalf("expected group error, got %v", err)
	}

	_, err = parseManageLocalGroupPayload(json.RawMessage(`{"username":"alice","group":"Administrators","action":"promote"}`))
	if err == nil || !strings.Contains(err.Error(), "action must be add or remove") {
		t.Fatalf("expected action error, got %v", err)
	}
}

func TestManageLocalGroupSuccessMessage(t *testing.T) {
	t.Parallel()

	addMsg := manageLocalGroupSuccessMessage("alice", "Administrators", "add")
	if addMsg != "User alice successfully added to group Administrators" {
		t.Fatalf("message = %q", addMsg)
	}
}

func TestManageLocalGroupSuccessMessageRemove(t *testing.T) {
	t.Parallel()

	removeMsg := manageLocalGroupSuccessMessage("bob", "Remote Desktop Users", "remove")
	if removeMsg != "User bob successfully removed from group Remote Desktop Users" {
		t.Fatalf("remove message = %q", removeMsg)
	}
}

func TestManageLocalGroupFromStringInvalidJSON(t *testing.T) {
	t.Parallel()

	result := manageLocalGroupFromString("{not-json")
	if result.Success {
		t.Fatal("expected failure for invalid payload")
	}
}
