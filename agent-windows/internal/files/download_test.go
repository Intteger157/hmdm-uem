//go:build windows

package files

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestDownloadFileResumableCompletesPartialDownload(t *testing.T) {
	t.Parallel()

	payload := []byte("0123456789abcdef")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rangeHeader := r.Header.Get("Range")
		switch rangeHeader {
		case "":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write(payload)
		case "bytes=8-":
			w.Header().Set("Content-Range", "bytes 8-15/16")
			w.WriteHeader(http.StatusPartialContent)
			_, _ = w.Write(payload[8:])
		default:
			t.Fatalf("unexpected Range header %q", rangeHeader)
		}
	}))
	defer server.Close()

	destPath := filepath.Join(t.TempDir(), "file.bin.part")
	if err := os.WriteFile(destPath, payload[:8], 0o644); err != nil {
		t.Fatal(err)
	}

	if err := downloadFileResumable(server.URL, destPath); err != nil {
		t.Fatalf("downloadFileResumable() error = %v", err)
	}

	got, err := os.ReadFile(destPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("downloaded content = %q, want %q", string(got), string(payload))
	}
}

func TestDownloadFileResumableRestartsWhenServerIgnoresRange(t *testing.T) {
	t.Parallel()

	payload := []byte("full-payload")
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(payload)
	}))
	defer server.Close()

	destPath := filepath.Join(t.TempDir(), "file.bin.part")
	if err := os.WriteFile(destPath, []byte("partial"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := downloadFileResumable(server.URL, destPath); err != nil {
		t.Fatalf("downloadFileResumable() error = %v", err)
	}
	if calls < 2 {
		t.Fatalf("expected restart when Range is ignored, calls=%d", calls)
	}
	got, err := os.ReadFile(destPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("downloaded content = %q, want %q", string(got), string(payload))
	}
}

func TestPartialDownloadPath(t *testing.T) {
	t.Parallel()

	if got := partialDownloadPath("/cache/file.zip"); got != "/cache/file.zip.part" {
		t.Fatalf("partialDownloadPath() = %q", got)
	}
}

func TestDownloadFileResumableEmptyResponse(t *testing.T) {
	t.Parallel()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte{})
	}))
	defer server.Close()

	destPath := filepath.Join(t.TempDir(), "empty.part")
	err := downloadFileResumable(server.URL, destPath)
	if err == nil {
		t.Fatal("expected error for empty download")
	}
}

func fileSize(t *testing.T, path string) int64 {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	return info.Size()
}
