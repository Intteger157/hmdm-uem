//go:build windows

package apps

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

const exitCodeSuccessRebootRequired = 3010

type installRunResult struct {
	ExitCode int
	Output   string
}

func isInstallerSuccess(exitCode int) bool {
	return exitCode == 0 || exitCode == exitCodeSuccessRebootRequired
}

func buildInstallerCommand(installerPath, installArgs string) (*exec.Cmd, string) {
	args := strings.Fields(strings.TrimSpace(installArgs))
	ext := strings.ToLower(filepath.Ext(installerPath))

	switch ext {
	case ".msi":
		if len(args) == 0 {
			cmdLine := fmt.Sprintf(`msiexec.exe /i "%s" /quiet /norestart`, installerPath)
			return exec.Command("msiexec.exe", "/i", installerPath, "/quiet", "/norestart"), cmdLine
		}
		msiArgs := append([]string{"/i", installerPath}, args...)
		cmdLine := fmt.Sprintf(`msiexec.exe %s`, strings.Join(quoteCommandParts(msiArgs), " "))
		return exec.Command("msiexec.exe", msiArgs...), cmdLine
	default:
		if len(args) == 0 {
			args = []string{"/S"}
		}
		cmdLine := fmt.Sprintf(`"%s" %s`, installerPath, strings.Join(quoteCommandParts(args), " "))
		return exec.Command(installerPath, args...), cmdLine
	}
}

func commandExitCode(cmd *exec.Cmd, runErr error) int {
	if cmd != nil && cmd.ProcessState != nil {
		return cmd.ProcessState.ExitCode()
	}
	if runErr == nil {
		return 0
	}
	if exitErr, ok := runErr.(*exec.ExitError); ok {
		return exitErr.ExitCode()
	}
	return -1
}

func quoteCommandParts(parts []string) []string {
	quoted := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.ContainsAny(part, " \t\"") {
			quoted = append(quoted, fmt.Sprintf(`"%s"`, part))
			continue
		}
		quoted = append(quoted, part)
	}
	return quoted
}
