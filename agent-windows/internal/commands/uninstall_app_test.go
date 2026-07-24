//go:build windows

package commands

import "testing"

func TestNormalizeUninstallString(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "escaped quotes",
			input: `\"C:\Program Files\App\unins000.exe\" /SILENT`,
			want:  `"C:\Program Files\App\unins000.exe" /SILENT`,
		},
		{
			name:  "single quoted wrapper",
			input: `'\"C:\Program Files\App\unins000.exe\" /SILENT'`,
			want:  `"C:\Program Files\App\unins000.exe" /SILENT`,
		},
		{
			name:  "plain registry string",
			input: `"C:\Program Files\App\unins000.exe" /SILENT`,
			want:  `"C:\Program Files\App\unins000.exe" /SILENT`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizeUninstallString(tc.input); got != tc.want {
				t.Fatalf("normalizeUninstallString() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestParseUninstallCommandLine(t *testing.T) {
	exe, args, ok := parseUninstallCommandLine(`"C:\Program Files\App\unins000.exe" /VERYSILENT /SUPPRESSMSGBOXES`)
	if !ok {
		t.Fatal("expected parse success")
	}
	if exe != `C:\Program Files\App\unins000.exe` {
		t.Fatalf("exe = %q", exe)
	}
	if len(args) != 2 || args[0] != "/VERYSILENT" || args[1] != "/SUPPRESSMSGBOXES" {
		t.Fatalf("args = %#v", args)
	}
}

func TestPrepareUninstallCommandAddsSilentFlags(t *testing.T) {
	got := prepareUninstallCommand(`"C:\App\unins000.exe"`)
	wantSuffix := `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
	if got != `"C:\App\unins000.exe" `+wantSuffix {
		t.Fatalf("prepareUninstallCommand() = %q", got)
	}
}
