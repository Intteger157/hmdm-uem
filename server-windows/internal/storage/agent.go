package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	agentSubdir      = "agent"
	AgentBinaryName  = "singularity-agent.exe"
)

// AgentDirectory returns the on-disk directory for the Windows agent binary.
func AgentDirectory() string {
	return filepath.Join(filesDirectory(), agentSubdir)
}

// AgentBinaryPath returns the full path to the published agent executable.
func AgentBinaryPath() string {
	return filepath.Join(AgentDirectory(), AgentBinaryName)
}

// EnsureAgentDirectory creates the agent binary directory if missing.
func EnsureAgentDirectory() error {
	dir := AgentDirectory()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("create agent directory: %w", err)
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

// AgentPublicPath is the HTTP path served by the gateway for the agent binary.
func AgentPublicPath() string {
	return "/storage/agent/" + AgentBinaryName
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
