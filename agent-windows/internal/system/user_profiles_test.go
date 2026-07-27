//go:build windows

package system

import "testing"

func TestParseProfileUsersJSONSupportsArray(t *testing.T) {
	t.Parallel()

	entries, err := parseProfileUsersJSON([]byte(`[{"Username":"AzureAD\\user@example.com","Status":"active"},{"Username":"DESKTOP\\alice","Status":"active"}]`))
	if err != nil {
		t.Fatalf("parseProfileUsersJSON() error = %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("entries = %d, want 2", len(entries))
	}
}

func TestParseProfileUsersJSONSupportsSingleObject(t *testing.T) {
	t.Parallel()

	entries, err := parseProfileUsersJSON([]byte(`{"Username":"AzureAD\\user@example.com","Status":"active"}`))
	if err != nil {
		t.Fatalf("parseProfileUsersJSON() error = %v", err)
	}
	if len(entries) != 1 || entries[0].Username != `AzureAD\user@example.com` {
		t.Fatalf("entries = %#v", entries)
	}
}

func TestMergeLocalUsersDeduplicatesAndPrefersQualifiedName(t *testing.T) {
	t.Parallel()

	merged := mergeLocalUsers(
		[]LocalUserInfo{{Username: "alice", IsAdmin: false, Status: "disabled"}},
		[]LocalUserInfo{{Username: `DESKTOP-PC\alice`, IsAdmin: true, Status: "active"}},
	)
	if len(merged) != 1 {
		t.Fatalf("merged = %#v", merged)
	}
	if merged[0].Username != `DESKTOP-PC\alice` {
		t.Fatalf("username = %q", merged[0].Username)
	}
	if !merged[0].IsAdmin {
		t.Fatal("expected admin flag to merge")
	}
	if merged[0].Status != "disabled" {
		t.Fatalf("status = %q, want disabled", merged[0].Status)
	}
}

func TestIsAdminUsernameMatchesDomainQualifiedName(t *testing.T) {
	t.Parallel()

	admins := map[string]bool{
		`AzureAD\user@example.com`: true,
	}
	if !isAdminUsername(`AzureAD\user@example.com`, admins) {
		t.Fatal("expected qualified username to match")
	}
	if !isAdminUsername("user@example.com", map[string]bool{"user@example.com": true}) {
		t.Fatal("expected short username to match")
	}
}

func TestShouldIncludeProfileUserAllowsAzureADAccount(t *testing.T) {
	t.Parallel()

	if !shouldIncludeProfileUser(`AzureAD\user@example.com`) {
		t.Fatal("expected Azure AD profile user to be included")
	}
}
