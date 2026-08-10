package handlers

import (
	"encoding/json"
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestBootstrapRegisterResponseIncludesAdminPasswordWhenProvisioningEnabled(t *testing.T) {
	response := models.BootstrapRegisterResponse{
		EnrollmentToken: "org-token",
		AdminPassword:   "P@ssw0rd!",
	}

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}

	var decoded map[string]string
	if err := json.Unmarshal(payload, &decoded); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if decoded["enrollment_token"] != "org-token" {
		t.Fatalf("unexpected enrollment_token: %q", decoded["enrollment_token"])
	}
	if decoded["admin_password"] != "P@ssw0rd!" {
		t.Fatalf("unexpected admin_password: %q", decoded["admin_password"])
	}
}

func TestBootstrapRegisterResponseOmitsEmptyAdminPassword(t *testing.T) {
	response := models.BootstrapRegisterResponse{
		EnrollmentToken: "org-token",
	}

	payload, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal response: %v", err)
	}
	if string(payload) != `{"enrollment_token":"org-token"}` {
		t.Fatalf("expected admin_password to be omitted, got %s", payload)
	}
}
