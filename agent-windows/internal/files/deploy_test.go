//go:build windows

package files

import (
	"errors"
	"fmt"
	"strings"
	"testing"
)

func TestDeploymentFailureMessageIncludesSystemError(t *testing.T) {
	t.Parallel()

	err := fmt.Errorf("create download directory: %w", errors.New("The system cannot find the path specified."))
	message := deploymentFailureMessage("", err)
	if message == "" {
		t.Fatal("expected non-empty failure message")
	}
	if !strings.Contains(message, "create download directory") {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
	if !strings.Contains(message, "The system cannot find the path specified.") {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
}

func TestDeploymentFailureMessageMergesOutputAndError(t *testing.T) {
	t.Parallel()

	message := deploymentFailureMessage("script output", errors.New("exit status 1"))
	if message != "script output\nexit status 1" {
		t.Fatalf("deploymentFailureMessage() = %q", message)
	}
}
