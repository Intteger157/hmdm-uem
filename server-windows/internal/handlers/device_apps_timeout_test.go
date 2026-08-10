package handlers

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestStaleAppDeploymentStatuses(t *testing.T) {
	want := map[string]struct{}{
		models.AppStatusPending:     {},
		models.AppStatusDownloading: {},
		models.AppStatusInstalling:  {},
	}
	for _, status := range staleAppDeploymentStatuses {
		if _, ok := want[status]; !ok {
			t.Fatalf("unexpected stale status %q", status)
		}
		delete(want, status)
	}
	if len(want) > 0 {
		t.Fatalf("missing stale statuses: %#v", want)
	}
}

func TestAppDeploymentTimeoutConstant(t *testing.T) {
	if models.AppStatusTimeout != "Timeout" {
		t.Fatalf("unexpected timeout status constant: %q", models.AppStatusTimeout)
	}
	if models.AppDeploymentTimeoutMessage == "" {
		t.Fatal("expected timeout message to be defined")
	}
}
