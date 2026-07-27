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

func TestLocalGroupMemberCommandUsesPowerShellWithAzureADUsername(t *testing.T) {
	t.Parallel()

	group := "Administrators"
	user := `AzureAD\user@example.com`
	cmd := newLocalGroupMemberCommand(localGroupActionAdd, group, user)
	if len(cmd.Args) < 4 {
		t.Fatalf("args = %#v", cmd.Args)
	}
	if cmd.Args[0] != "powershell.exe" {
		t.Fatalf("executable = %q, want powershell.exe", cmd.Args[0])
	}
	script := cmd.Args[len(cmd.Args)-1]
	if !strings.Contains(script, "Add-LocalGroupMember") {
		t.Fatalf("script = %q, expected Add-LocalGroupMember", script)
	}
	if !strings.Contains(script, `AzureAD\user@example.com`) {
		t.Fatalf("script = %q, expected Azure AD username preserved", script)
	}
}

func TestBuildLocalGroupMemberScriptRemove(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMemberScript(localGroupActionRemove, "Remote Desktop Users", "alice")
	if !strings.Contains(script, "Remove-LocalGroupMember") {
		t.Fatalf("script = %q", script)
	}
	if !strings.Contains(script, "'remove' -eq 'add'") {
		t.Fatalf("script = %q, expected remove action branch", script)
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

	addMsg := manageLocalGroupSuccessMessage("bob", "Administrators", "add")
	if addMsg != "User bob successfully added to group Administrators" {
		t.Fatalf("add message = %q", addMsg)
	}

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
