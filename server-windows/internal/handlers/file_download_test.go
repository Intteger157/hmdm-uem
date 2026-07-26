package handlers

import (
	"path/filepath"
	"testing"
)

func TestSafeStoredFileRelativePath(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
		ok    bool
	}{
		{input: "/report.zip", want: "report.zip", ok: true},
		{input: "nested/report.zip", want: filepath.Join("nested", "report.zip"), ok: true},
		{input: "../secret.txt", ok: false},
		{input: "", ok: false},
	}

	for _, tc := range tests {
		got, ok := safeStoredFileRelativePath(tc.input)
		if ok != tc.ok {
			t.Fatalf("safeStoredFileRelativePath(%q) ok = %v, want %v", tc.input, ok, tc.ok)
		}
		if !tc.ok {
			continue
		}
		if got != tc.want {
			t.Fatalf("safeStoredFileRelativePath(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}
