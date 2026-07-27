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
	if !strings.Contains(script, "NTAccount") || !strings.Contains(script, "SecurityIdentifier") {
		t.Fatalf("script = %q, expected SID resolution via NTAccount", script)
	}
	if !strings.Contains(script, "Add-LocalGroupMember -Group 'Administrators' -Member $sid") {
		t.Fatalf("script = %q, expected Add-LocalGroupMember with SID variable", script)
	}
	if !strings.Contains(script, `AzureAD\user@example.com`) {
		t.Fatalf("script = %q, expected Azure AD username preserved for SID lookup", script)
	}
}

func TestBuildLocalGroupMemberScriptRemoveUsesGetLocalGroupMember(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMemberScript(localGroupActionRemove, "Remote Desktop Users", `AzureAD\user@example.com`)
	if !strings.Contains(script, "Get-LocalGroupMember -Group 'Remote Desktop Users'") {
		t.Fatalf("script = %q, expected Get-LocalGroupMember", script)
	}
	if !strings.Contains(script, "Where-Object { $_.Name -match") {
		t.Fatalf("script = %q, expected name filtering", script)
	}
	if !strings.Contains(script, "Remove-LocalGroupMember -Group 'Remote Desktop Users' -Member $member.SID") {
		t.Fatalf("script = %q, expected removal by discovered member SID", script)
	}
	if !strings.Contains(script, localGroupMemberNotFoundOutput) {
		t.Fatalf("script = %q, expected not-found success message", script)
	}
	if strings.Contains(script, "NTAccount") {
		t.Fatalf("script = %q, remove should not translate NTAccount directly", script)
	}
}

func TestBuildLocalGroupMemberScriptAddUsesCmdletWithSID(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMemberScript(localGroupActionAdd, "Administrators", "alice")
	if !strings.Contains(script, "Add-LocalGroupMember -Group 'Administrators' -Member $sid") {
		t.Fatalf("script = %q, expected Add-LocalGroupMember with SID variable", script)
	}
	if strings.Contains(script, "net localgroup") {
		t.Fatalf("script = %q, should not use net localgroup", script)
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

func TestBuildLocalGroupMemberScriptHandlesExistingMembership(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMemberScript(localGroupActionAdd, "Administrators", "alice")
	if !strings.Contains(script, "try {") || !strings.Contains(script, "} catch {") {
		t.Fatalf("script = %q, expected try/catch wrapper", script)
	}
	if !strings.Contains(script, "MemberExists") {
		t.Fatalf("script = %q, expected add idempotent exception handling", script)
	}
	if !strings.Contains(script, localGroupAlreadyAppliedOutput) {
		t.Fatalf("script = %q, expected already-applied marker output", script)
	}
}

func TestBuildLocalGroupMemberScriptEscapesSingleQuotes(t *testing.T) {
	t.Parallel()

	script := buildLocalGroupMemberScript(localGroupActionAdd, "O'Brien Users", "AzureAD\\user'@example.com")
	if !strings.Contains(script, "O''Brien Users") {
		t.Fatalf("script = %q, expected escaped group name", script)
	}
	if !strings.Contains(script, `AzureAD\user''@example.com`) {
		t.Fatalf("script = %q, expected escaped username", script)
	}
}

func TestManageLocalGroupResultMessageAlreadyApplied(t *testing.T) {
	t.Parallel()

	addMsg := manageLocalGroupResultMessage("alice", "Administrators", "add", localGroupAlreadyAppliedOutput)
	if addMsg != "User is already a member of the group." {
		t.Fatalf("add message = %q", addMsg)
	}

	removeMsg := manageLocalGroupResultMessage("alice", "Administrators", "remove", localGroupMemberNotFoundOutput)
	if removeMsg != localGroupMemberNotFoundOutput {
		t.Fatalf("remove message = %q", removeMsg)
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
