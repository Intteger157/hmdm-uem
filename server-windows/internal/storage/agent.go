package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	AutopilotSubdir  = "singularity-autopilot"
	AgentBinaryName  = "singularity-agent.exe"
	agentMetaFileName = "agent-meta.json"
)

// AgentBinaryMeta stores parsed metadata for the published autopilot agent binary.
type AgentBinaryMeta struct {
	Version     string    `json:"version"`
	ProductName string    `json:"productName,omitempty"`
	UploadedAt  time.Time `json:"uploadedAt"`
}

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

// AgentMetaPath returns the on-disk path for autopilot agent metadata.
func AgentMetaPath() string {
	return filepath.Join(AutopilotDirectory(), agentMetaFileName)
}

// LoadAgentBinaryMeta reads stored metadata for the autopilot agent binary.
func LoadAgentBinaryMeta() (AgentBinaryMeta, bool) {
	data, err := os.ReadFile(AgentMetaPath())
	if err != nil {
		return AgentBinaryMeta{}, false
	}
	var meta AgentBinaryMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return AgentBinaryMeta{}, false
	}
	return meta, true
}

// SaveAgentBinaryMeta persists metadata for the autopilot agent binary.
func SaveAgentBinaryMeta(meta AgentBinaryMeta) error {
	if err := EnsureAgentDirectory(); err != nil {
		return err
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal agent metadata: %w", err)
	}
	tempPath := AgentMetaPath() + ".tmp"
	if err := os.WriteFile(tempPath, data, 0o644); err != nil {
		return fmt.Errorf("write agent metadata temp file: %w", err)
	}
	if err := os.Rename(tempPath, AgentMetaPath()); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace agent metadata: %w", err)
	}
	return nil
}

// AgentBinaryStat returns file info for the published autopilot agent binary.
func AgentBinaryStat() (os.FileInfo, bool) {
	info, err := os.Stat(AgentBinaryPath())
	if err != nil || info.IsDir() || info.Size() <= 0 {
		return nil, false
	}
	return info, true
}

// ReplaceAgentBinary atomically replaces the published autopilot agent binary.
func ReplaceAgentBinary(sourcePath string) error {
	if err := EnsureAgentDirectory(); err != nil {
		return err
	}
	destPath := AgentBinaryPath()
	tempPath := destPath + ".tmp"
	if err := copyFile(sourcePath, tempPath); err != nil {
		_ = os.Remove(tempPath)
		return err
	}
	if err := os.Rename(tempPath, destPath); err != nil {
		_ = os.Remove(tempPath)
		return fmt.Errorf("replace agent binary: %w", err)
	}
	return nil
}

func copyFile(sourcePath, destPath string) error {
	source, err := os.Open(sourcePath)
	if err != nil {
		return fmt.Errorf("open source binary: %w", err)
	}
	defer source.Close()

	dest, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return fmt.Errorf("create destination binary: %w", err)
	}

	if _, err := dest.ReadFrom(source); err != nil {
		dest.Close()
		return fmt.Errorf("copy agent binary: %w", err)
	}
	if err := dest.Close(); err != nil {
		return fmt.Errorf("close destination binary: %w", err)
	}
	return nil
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
