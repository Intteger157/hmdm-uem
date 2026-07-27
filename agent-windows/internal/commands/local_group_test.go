//go:build windows

package commands

import (
	"encoding/json"
	"os/exec"
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

func TestRunNetLocalGroupCommandPreservesBackslashArgument(t *testing.T) {
	t.Parallel()

	group := "Administrators"
	user := `AzureAD\user@example.com`
	flag := "/add"
	cmd := exec.Command("net", "localgroup", group, user, flag)
	if len(cmd.Args) < 5 {
		t.Fatalf("args = %#v", cmd.Args)
	}
	if cmd.Args[3] != user {
		t.Fatalf("username arg = %q, want %q", cmd.Args[3], user)
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
