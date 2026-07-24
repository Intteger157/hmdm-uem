package metadata

import "testing"

func TestParseFilenameMetadata(t *testing.T) {
	tests := []struct {
		name            string
		filename        string
		wantName        string
		wantVersion     string
	}{
		{
			name:        "obs studio example",
			filename:    "OBS-Studio-32.1.2-Windows-x64-Installer.exe",
			wantName:    "OBS Studio",
			wantVersion: "32.1.2",
		},
		{
			name:        "no version installer noise",
			filename:    "SlothClash-windows-amd64-installer.exe",
			wantName:    "SlothClash",
			wantVersion: "",
		},
		{
			name:        "version prefix v",
			filename:    "MyApp-v1.5.0-setup.exe",
			wantName:    "MyApp",
			wantVersion: "1.5.0",
		},
		{
			name:        "four part version",
			filename:    "Product_2.0.0.1_x64.exe",
			wantName:    "Product",
			wantVersion: "2.0.0.1",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ParseFilenameMetadata(tc.filename)
			if got.Name != tc.wantName {
				t.Fatalf("Name = %q, want %q", got.Name, tc.wantName)
			}
			if got.Version != tc.wantVersion {
				t.Fatalf("Version = %q, want %q", got.Version, tc.wantVersion)
			}
		})
	}
}

func TestCleanFilenameName(t *testing.T) {
	if got := cleanFilenameName("OBS-Studio-"); got != "OBS Studio" {
		t.Fatalf("cleanFilenameName() = %q", got)
	}
}
