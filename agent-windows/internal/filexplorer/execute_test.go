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

			cmd, err := buildExecuteCommand(targetPath)
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

	cmd, err := buildExecuteCommand(targetPath)
	if err != nil {
		t.Fatalf("buildExecuteCommand: %v", err)
	}
	if len(cmd.Args) < 2 || cmd.Args[0] != "msiexec" || cmd.Args[1] != "/i" {
		t.Fatalf("expected msiexec /i, got %#v", cmd.Args)
	}
}
