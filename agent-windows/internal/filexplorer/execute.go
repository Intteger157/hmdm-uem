//go:build windows

package filexplorer

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

func buildExecuteCommand(path string) (*exec.Cmd, error) {
	cleanPath, err := normalizeFilePath(path)
	if err != nil {
		return nil, err
	}

	info, err := os.Stat(cleanPath)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("path is a directory")
	}

	switch strings.ToLower(filepath.Ext(cleanPath)) {
	case ".msi":
		return exec.Command("msiexec", "/i", cleanPath, "/qn", "/norestart"), nil
	case ".ps1":
		return exec.Command(
			"powershell",
			"-ExecutionPolicy", "Bypass",
			"-WindowStyle", "Hidden",
			"-File", cleanPath,
		), nil
	case ".bat", ".cmd":
		return exec.Command("cmd", "/c", cleanPath), nil
	default:
		return exec.Command(cleanPath), nil
	}
}

func startExecutable(path string) error {
	cmd, err := buildExecuteCommand(path)
	if err != nil {
		return err
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
