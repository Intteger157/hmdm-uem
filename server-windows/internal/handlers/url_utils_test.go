package handlers

import "testing"

func TestNormalizeDownloadURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "upgrades public http",
			input:    "http://test-dev-mdm.example.uk/storage/apps/installer.exe",
			expected: "https://test-dev-mdm.example.uk/storage/apps/installer.exe",
		},
		{
			name:     "keeps localhost http",
			input:    "http://localhost:8080/storage/apps/installer.exe",
			expected: "http://localhost:8080/storage/apps/installer.exe",
		},
		{
			name:     "keeps https",
			input:    "https://mdm.example.com/storage/apps/installer.exe",
			expected: "https://mdm.example.com/storage/apps/installer.exe",
		},
		{
			name:     "keeps relative path",
			input:    "/storage/apps/installer.exe",
			expected: "/storage/apps/installer.exe",
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := normalizeDownloadURL(tc.input)
			if got != tc.expected {
				t.Fatalf("normalizeDownloadURL() = %q, want %q", got, tc.expected)
			}
		})
	}
}

func TestIsPublicHostname(t *testing.T) {
	t.Parallel()

	if !isPublicHostname("test-dev-mdm.inttegere.uk") {
		t.Fatal("expected public hostname")
	}
	if isPublicHostname("localhost:8080") {
		t.Fatal("expected localhost to be non-public")
	}
}
