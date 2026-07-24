package metadata

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNormalizeVersion(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{input: "1,2,3,4", want: "1.2.3.4"},
		{input: "v2.5.0", want: "2.5.0"},
		{input: "  10.0.0.1  ", want: "10.0.0.1"},
		{input: "", want: ""},
	}

	for _, tc := range tests {
		if got := NormalizeVersion(tc.input); got != tc.want {
			t.Fatalf("NormalizeVersion(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestResolveInstallerMetadataUsesFilenameWithoutEmbeddedVersion(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "SlothClash-windows-amd64-installer.exe")
	if err := os.WriteFile(path, []byte("not-a-real-pe"), 0o644); err != nil {
		t.Fatal(err)
	}

	meta := ResolveInstallerMetadata(path, "SlothClash-windows-amd64-installer.exe")
	if meta.Name != "SlothClash" {
		t.Fatalf("Name = %q, want SlothClash", meta.Name)
	}
	if meta.Version != "" {
		t.Fatalf("Version = %q, want empty", meta.Version)
	}
}

func TestResolveInstallerMetadataUsesFilenameVersion(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(path, []byte("not-a-real-pe"), 0o644); err != nil {
		t.Fatal(err)
	}

	meta := ResolveInstallerMetadata(path, "MyApp-3.2.1-setup.exe")
	if meta.Version != "3.2.1" {
		t.Fatalf("Version = %q, want 3.2.1", meta.Version)
	}
}

func TestMsiDecodeStreamName(t *testing.T) {
	t.Parallel()

	if got := msiDecodeStreamName("Property"); got != "Property" {
		t.Fatalf("msiDecodeStreamName(Property) = %q", got)
	}
}

func TestScanMetadataFromBinary(t *testing.T) {
	t.Parallel()

	data := []byte("prefix ProductVersion\x009.8.7\x00 suffix")
	meta := scanMetadataFromBinary(data)
	if meta.Version != "9.8.7" {
		t.Fatalf("Version = %q, want 9.8.7", meta.Version)
	}
}
