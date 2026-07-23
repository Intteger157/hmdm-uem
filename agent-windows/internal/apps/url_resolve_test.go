package apps

import "testing"

func TestResolveDownloadURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		baseURL  string
		input    string
		expected string
		wantErr  bool
	}{
		{
			name:     "absolute https unchanged",
			baseURL:  "https://mdm.example.com",
			input:    "https://cdn.example.com/app.exe",
			expected: "https://cdn.example.com/app.exe",
		},
		{
			name:     "root relative storage path",
			baseURL:  "https://mdm.example.com",
			input:    "/storage/apps/installer.exe",
			expected: "https://mdm.example.com/storage/apps/installer.exe",
		},
		{
			name:     "root relative with http base",
			baseURL:  "http://10.0.0.5",
			input:    "/storage/apps/setup.msi",
			expected: "http://10.0.0.5/storage/apps/setup.msi",
		},
		{
			name:     "relative to base",
			baseURL:  "https://mdm.example.com/rest",
			input:    "downloads/app.exe",
			expected: "https://mdm.example.com/downloads/app.exe",
		},
		{
			name:    "empty url",
			baseURL: "https://mdm.example.com",
			input:   "   ",
			wantErr: true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := resolveDownloadURL(tc.baseURL, tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("resolveDownloadURL() error = %v", err)
			}
			if got != tc.expected {
				t.Fatalf("resolveDownloadURL() = %q, want %q", got, tc.expected)
			}
		})
	}
}
