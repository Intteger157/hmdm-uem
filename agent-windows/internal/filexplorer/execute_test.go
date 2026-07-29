//go:build windows

package filexplorer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestBuildExecuteCommandRoutesByExtension(t *testing.T) {
	dir := t.TempDir()

	tests := []struct {
		name     string
		filename string
		wantArgs []string
	}{
		{
			name:     "msi",
			filename: "setup.msi",
			wantArgs: []string{"msiexec", "/i", filepath.Join(dir, "setup.msi"), "/qn", "/norestart"},
		},
		{
			name:     "ps1",
			filename: "script.ps1",
			wantArgs: []string{
				"powershell",
				"-ExecutionPolicy", "Bypass",
				"-WindowStyle", "Hidden",
				"-File", filepath.Join(dir, "script.ps1"),
			},
		},
		{
			name:     "bat",
			filename: "run.bat",
			wantArgs: []string{"cmd", "/c", filepath.Join(dir, "run.bat")},
		},
		{
			name:     "cmd",
			filename: "run.cmd",
			wantArgs: []string{"cmd", "/c", filepath.Join(dir, "run.cmd")},
		},
		{
			name:     "exe",
			filename: "app.exe",
			wantArgs: []string{filepath.Join(dir, "app.exe")},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			targetPath := filepath.Join(dir, testCase.filename)
			if err := os.WriteFile(targetPath, []byte("test"), 0o644); err != nil {
				t.Fatalf("write file: %v", err)
			}

			cmd, err := buildExecuteCommand(targetPath, nil)
			if err != nil {
				t.Fatalf("buildExecuteCommand: %v", err)
			}
			if len(cmd.Args) != len(testCase.wantArgs) {
				t.Fatalf("args = %#v want %#v", cmd.Args, testCase.wantArgs)
			}
			for index, want := range testCase.wantArgs {
				if cmd.Args[index] != want {
					t.Fatalf("args[%d] = %q want %q (full args=%#v)", index, cmd.Args[index], want, cmd.Args)
				}
			}
		})
	}
}

func TestBuildExecuteCommandMsiCaseInsensitive(t *testing.T) {
	dir := t.TempDir()
	targetPath := filepath.Join(dir, "SETUP.MSI")
	if err := os.WriteFile(targetPath, []byte("test"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	cmd, err := buildExecuteCommand(targetPath, nil)
	if err != nil {
		t.Fatalf("buildExecuteCommand: %v", err)
	}
	if len(cmd.Args) < 2 || cmd.Args[0] != "msiexec" || cmd.Args[1] != "/i" {
		t.Fatalf("expected msiexec /i, got %#v", cmd.Args)
	}
}

func TestBuildExecuteCommandExeWithCustomArgs(t *testing.T) {
	dir := t.TempDir()
	targetPath := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(targetPath, []byte("test"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	cmd, err := buildExecuteCommand(targetPath, []string{"/S", "/v/qn"})
	if err != nil {
		t.Fatalf("buildExecuteCommand: %v", err)
	}

	wantArgs := []string{targetPath, "/S", "/v/qn"}
	if len(cmd.Args) != len(wantArgs) {
		t.Fatalf("args = %#v want %#v", cmd.Args, wantArgs)
	}
	for index, want := range wantArgs {
		if cmd.Args[index] != want {
			t.Fatalf("args[%d] = %q want %q", index, cmd.Args[index], want)
		}
	}
}

func TestBuildExecuteCommandMsiAppendsCustomArgs(t *testing.T) {
	dir := t.TempDir()
	targetPath := filepath.Join(dir, "setup.msi")
	if err := os.WriteFile(targetPath, []byte("test"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	cmd, err := buildExecuteCommand(targetPath, []string{"PROPERTY=VALUE"})
	if err != nil {
		t.Fatalf("buildExecuteCommand: %v", err)
	}

	wantArgs := []string{"msiexec", "/i", targetPath, "/qn", "/norestart", "PROPERTY=VALUE"}
	if len(cmd.Args) != len(wantArgs) {
		t.Fatalf("args = %#v want %#v", cmd.Args, wantArgs)
	}
	for index, want := range wantArgs {
		if cmd.Args[index] != want {
			t.Fatalf("args[%d] = %q want %q", index, cmd.Args[index], want)
		}
	}
}

func TestParseExecuteCommandWithArgs(t *testing.T) {
	cmd, err := parseIncomingCommand([]byte(`{"action":"execute","path":"C:\\Temp\\setup.exe","args":["/S","/v/qn"]}`))
	if err != nil {
		t.Fatalf("parse execute: %v", err)
	}
	if cmd.Action != ActionExecute || cmd.Path != `C:\Temp\setup.exe` {
		t.Fatalf("unexpected command: %+v", cmd)
	}
	if len(cmd.Args) != 2 || cmd.Args[0] != "/S" || cmd.Args[1] != "/v/qn" {
		t.Fatalf("args = %#v", cmd.Args)
	}
}
