package metadata

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectInstallerArgs(t *testing.T) {
	t.Run("msi extension", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "app.msi")
		if err := os.WriteFile(path, []byte("dummy"), 0o644); err != nil {
			t.Fatal(err)
		}

		got, err := DetectInstallerArgs(path)
		if err != nil {
			t.Fatalf("DetectInstallerArgs() error = %v", err)
		}
		if got != "/quiet /norestart" {
			t.Fatalf("DetectInstallerArgs() = %q, want %q", got, "/quiet /norestart")
		}
	})

	t.Run("nsis signature", func(t *testing.T) {
		path := writeDetectFixture(t, "nsis.exe", append([]byte("prefix-"), nsisSignature...))
		got, err := DetectInstallerArgs(path)
		if err != nil {
			t.Fatalf("DetectInstallerArgs() error = %v", err)
		}
		if got != "/S" {
			t.Fatalf("DetectInstallerArgs() = %q, want %q", got, "/S")
		}
	})

	t.Run("inno setup signature", func(t *testing.T) {
		path := writeDetectFixture(t, "inno.exe", append([]byte("meta "), innoSetupSignature...))
		got, err := DetectInstallerArgs(path)
		if err != nil {
			t.Fatalf("DetectInstallerArgs() error = %v", err)
		}
		if got != "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART" {
			t.Fatalf("DetectInstallerArgs() = %q, want %q", got, "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART")
		}
	})

	t.Run("installshield signature", func(t *testing.T) {
		path := writeDetectFixture(t, "is.exe", append(installShieldSignature, []byte(" setup")...))
		got, err := DetectInstallerArgs(path)
		if err != nil {
			t.Fatalf("DetectInstallerArgs() error = %v", err)
		}
		if got != `/s /v"/qn"` {
			t.Fatalf("DetectInstallerArgs() = %q, want %q", got, `/s /v"/qn"`)
		}
	})

	t.Run("unknown exe", func(t *testing.T) {
		path := writeDetectFixture(t, "generic.exe", []byte("no installer markers here"))
		got, err := DetectInstallerArgs(path)
		if err != nil {
			t.Fatalf("DetectInstallerArgs() error = %v", err)
		}
		if got != "" {
			t.Fatalf("DetectInstallerArgs() = %q, want empty", got)
		}
	})
}

func writeDetectFixture(t *testing.T, name string, content []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}
