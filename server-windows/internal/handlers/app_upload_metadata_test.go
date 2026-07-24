package handlers

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveUploadMetadataSkipsBinaryParseWhenManualFieldsProvided(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(path, []byte("not-a-real-pe"), 0o644); err != nil {
		t.Fatal(err)
	}

	meta := resolveUploadMetadata(path, "Ignored-9.9.9-name.exe", "2.0.0", "Acme Corp")
	if meta.Version != "2.0.0" {
		t.Fatalf("Version = %q, want 2.0.0", meta.Version)
	}
	if meta.Publisher != "Acme Corp" {
		t.Fatalf("Publisher = %q, want Acme Corp", meta.Publisher)
	}
	if meta.Name != "Ignored-9.9.9-name" {
		t.Fatalf("Name = %q, want filename fallback", meta.Name)
	}
}

func TestResolveUploadMetadataUsesBinaryParseForMissingManualFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(path, []byte("not-a-real-pe"), 0o644); err != nil {
		t.Fatal(err)
	}

	meta := resolveUploadMetadata(path, "MyApp-3.2.1-setup.exe", "", "")
	if meta.Version != "3.2.1" {
		t.Fatalf("Version = %q, want 3.2.1", meta.Version)
	}
}

func TestResolveUploadMetadataOverridesSingleManualField(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "setup.exe")
	if err := os.WriteFile(path, []byte("not-a-real-pe"), 0o644); err != nil {
		t.Fatal(err)
	}

	meta := resolveUploadMetadata(path, "MyApp-3.2.1-setup.exe", "9.0.0", "")
	if meta.Version != "9.0.0" {
		t.Fatalf("Version = %q, want manual override 9.0.0", meta.Version)
	}
}
