//go:build windows

package session

import (
	"fmt"
	"os/exec"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

const (
	createNoWindow   = 0x08000000
	createUnicodeEnv = 0x00000400
)

// RunInteractive launches a command in the logged-on user's interactive session.
func RunInteractive(commandLine string) error {
	if err := runInActiveConsoleSession(commandLine); err == nil {
		return nil
	}
	return runViaScheduledTask(commandLine)
}

func runInActiveConsoleSession(commandLine string) error {
	sessionID := windows.WTSGetActiveConsoleSessionId()
	if sessionID == 0xFFFFFFFF {
		return fmt.Errorf("no active console session")
	}

	var userToken windows.Token
	if err := windows.WTSQueryUserToken(sessionID, &userToken); err != nil {
		return fmt.Errorf("query user token: %w", err)
	}
	defer userToken.Close()

	var primaryToken windows.Token
	if err := windows.DuplicateTokenEx(
		userToken,
		windows.TOKEN_ASSIGN_PRIMARY|
			windows.TOKEN_DUPLICATE|
			windows.TOKEN_QUERY|
			windows.TOKEN_ADJUST_DEFAULT|
			windows.TOKEN_ADJUST_SESSIONID,
		nil,
		windows.SecurityImpersonation,
		windows.TokenPrimary,
		&primaryToken,
	); err != nil {
		return fmt.Errorf("duplicate token: %w", err)
	}
	defer primaryToken.Close()

	if err := windows.SetTokenInformation(
		primaryToken,
		windows.TokenSessionId,
		(*byte)(unsafe.Pointer(&sessionID)),
		uint32(unsafe.Sizeof(sessionID)),
	); err != nil {
		return fmt.Errorf("set token session id: %w", err)
	}

	var envBlock *uint16
	if err := windows.CreateEnvironmentBlock(&envBlock, primaryToken, false); err != nil {
		return fmt.Errorf("create environment block: %w", err)
	}
	defer windows.DestroyEnvironmentBlock(envBlock)

	cmdLineUTF16, err := windows.UTF16PtrFromString(commandLine)
	if err != nil {
		return fmt.Errorf("encode command line: %w", err)
	}

	si := &windows.StartupInfo{
		Desktop: windows.StringToUTF16Ptr(`winsta0\default`),
	}
	pi := &windows.ProcessInformation{}

	if err := windows.CreateProcessAsUser(
		primaryToken,
		nil,
		cmdLineUTF16,
		nil,
		nil,
		false,
		createNoWindow|createUnicodeEnv,
		envBlock,
		nil,
		si,
		pi,
	); err != nil {
		return fmt.Errorf("create process as user: %w", err)
	}

	windows.CloseHandle(pi.Thread)
	windows.CloseHandle(pi.Process)
	return nil
}

func runViaScheduledTask(commandLine string) error {
	taskName := fmt.Sprintf("HMDMAgent_%d", time.Now().UnixNano())

	defer func() {
		cleanup := exec.Command("schtasks.exe", "/Delete", "/TN", taskName, "/F")
		cleanup.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		_ = cleanup.Run()
	}()

	create := exec.Command(
		"schtasks.exe",
		"/Create",
		"/TN", taskName,
		"/TR", commandLine,
		"/SC", "ONCE",
		"/ST", "00:00",
		"/F",
		"/IT",
	)
	create.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := create.CombinedOutput(); err != nil {
		return fmt.Errorf("create interactive task: %w (%s)", err, trimOutput(output))
	}

	run := exec.Command("schtasks.exe", "/Run", "/TN", taskName)
	run.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if output, err := run.CombinedOutput(); err != nil {
		return fmt.Errorf("run interactive task: %w (%s)", err, trimOutput(output))
	}

	return nil
}

func trimOutput(raw []byte) string {
	const maxLen = 500
	text := string(raw)
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen] + "..."
}
