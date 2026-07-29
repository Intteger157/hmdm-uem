//go:build windows

package filexplorer

import (
	"fmt"
	"os"
	"os/exec"
	"syscall"
)

func startExecutable(path string) error {
	cleanPath, err := normalizeFilePath(path)
	if err != nil {
		return err
	}

	info, err := os.Stat(cleanPath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("path is a directory")
	}

	cmd := exec.Command(cleanPath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	return nil
}
