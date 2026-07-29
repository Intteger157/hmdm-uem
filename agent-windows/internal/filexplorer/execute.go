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

func buildExecuteCommand(path string, args []string) (*exec.Cmd, error) {
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

	extraArgs := normalizeExecuteArgs(args)

	switch strings.ToLower(filepath.Ext(cleanPath)) {
	case ".msi":
		msiArgs := append([]string{"/i", cleanPath, "/qn", "/norestart"}, extraArgs...)
		return exec.Command("msiexec", msiArgs...), nil
	case ".ps1":
		psArgs := append(
			[]string{"-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", cleanPath},
			extraArgs...,
		)
		return exec.Command("powershell", psArgs...), nil
	case ".bat", ".cmd":
		cmdArgs := append([]string{"/c", cleanPath}, extraArgs...)
		return exec.Command("cmd", cmdArgs...), nil
	default:
		return exec.Command(cleanPath, extraArgs...), nil
	}
}

func normalizeExecuteArgs(args []string) []string {
	if len(args) == 0 {
		return nil
	}
	normalized := make([]string, 0, len(args))
	for _, arg := range args {
		if strings.TrimSpace(arg) == "" {
			continue
		}
		normalized = append(normalized, arg)
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func startExecutable(path string, args []string) error {
	cmd, err := buildExecuteCommand(path, args)
	if err != nil {
		return err
	}

	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
