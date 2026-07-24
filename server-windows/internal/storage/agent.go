package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	AutopilotSubdir = "singularity-autopilot"
	AgentBinaryName = "singularity-agent.exe"
)

// AutopilotDirectory returns the on-disk directory for the bootstrap/autopilot agent binary.
func AutopilotDirectory() string {
	return filepath.Join(filesDirectory(), AutopilotSubdir)
}

// AgentDirectory is an alias for AutopilotDirectory (bootstrap agent storage).
func AgentDirectory() string {
	return AutopilotDirectory()
}

// AgentBinaryPath returns the full path to the published autopilot agent executable.
func AgentBinaryPath() string {
	return filepath.Join(AutopilotDirectory(), AgentBinaryName)
}

// EnsureAgentDirectory creates the autopilot agent binary directory if missing.
func EnsureAgentDirectory() error {
	dir := AutopilotDirectory()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create autopilot agent directory: %w", err)
	}
	return nil
}

// AgentBinaryConfigured reports whether the bootstrap agent binary is present.
func AgentBinaryConfigured() bool {
	info, err := os.Stat(AgentBinaryPath())
	if err != nil || info.IsDir() {
		return false
	}
	return info.Size() > 0
}

// AgentPublicPath is the HTTP path served by the gateway for the autopilot agent binary.
func AgentPublicPath() string {
	return "/storage/singularity-autopilot/" + AgentBinaryName
}

// NormalizeAgentPublicPath trims user input to the canonical public path.
func NormalizeAgentPublicPath(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return AgentPublicPath()
	}
	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}
	return trimmed
}
