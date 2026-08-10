package models

import (
	"encoding/json"
	"testing"
)

func TestResolveAndroidInfoJSONPreservesPermissions(t *testing.T) {
	raw := json.RawMessage(`{"model":"A35","permissions":[1,1,1],"applications":[{"pkg":"com.hmdm.launcher","version":"6.26"}]}`)
	got := ResolveAndroidInfoJSON(raw, nil)
	if len(got) == 0 {
		t.Fatal("expected raw info payload")
	}

	var parsed map[string]any
	if err := json.Unmarshal(got, &parsed); err != nil {
		t.Fatalf("unmarshal info: %v", err)
	}

	permissions, ok := parsed["permissions"].([]any)
	if !ok || len(permissions) != 3 {
		t.Fatalf("permissions missing from info payload: %#v", parsed["permissions"])
	}
}

func TestResolveAndroidInfoJSONLegacyFallback(t *testing.T) {
	legacy := `{"androidVersion":"14","permissions":[1,0,1]}`
	got := ResolveAndroidInfoJSON(nil, &legacy)
	if len(got) == 0 {
		t.Fatal("expected legacy info payload")
	}
}
