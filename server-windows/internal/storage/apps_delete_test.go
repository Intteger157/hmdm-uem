package storage

import "testing"

func TestLocalPathFromAppFileURL(t *testing.T) {
	t.Setenv("APPS_UPLOAD_DIR", t.TempDir())

	tests := []struct {
		name    string
		fileURL string
		wantOK  bool
	}{
		{
			name:    "absolute public url",
			fileURL: "https://mdm.example.com/storage/apps/installer.exe",
			wantOK:  true,
		},
		{
			name:    "public path",
			fileURL: "/storage/apps/installer.msi",
			wantOK:  true,
		},
		{
			name:    "external url",
			fileURL: "https://cdn.example.com/apps/installer.exe",
			wantOK:  false,
		},
		{
			name:    "empty",
			fileURL: "",
			wantOK:  false,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got, ok := LocalPathFromAppFileURL(tc.fileURL)
			if ok != tc.wantOK {
				t.Fatalf("LocalPathFromAppFileURL() ok = %v, want %v (path=%q)", ok, tc.wantOK, got)
			}
			if tc.wantOK && got == "" {
				t.Fatal("expected non-empty local path")
			}
		})
	}
}
