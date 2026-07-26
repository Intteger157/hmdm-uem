package httputil

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestThrottledReaderLimitsThroughput(t *testing.T) {
	t.Parallel()

	payload := bytes.Repeat([]byte("a"), 1<<20)
	reader := NewThrottledReader(bytes.NewReader(payload), 128<<10)

	start := time.Now()
	copied, err := io.Copy(io.Discard, reader)
	elapsed := time.Since(start)
	if err != nil {
		t.Fatalf("Copy() error = %v", err)
	}
	if copied != int64(len(payload)) {
		t.Fatalf("Copy() = %d, want %d", copied, len(payload))
	}
	if elapsed < 3*time.Second {
		t.Fatalf("expected throttling to slow copy, elapsed=%v", elapsed)
	}
}

func TestThrottledReadSeekerReadAndSeek(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	path := filepath.Join(dir, "sample.bin")
	content := []byte("0123456789abcdef")
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}

	reader, err := NewThrottledReadSeeker(path, 8<<20)
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()

	if _, err := reader.Seek(4, io.SeekStart); err != nil {
		t.Fatalf("Seek() error = %v", err)
	}

	buf := make([]byte, 4)
	if _, err := io.ReadFull(reader, buf); err != nil {
		t.Fatalf("ReadFull() error = %v", err)
	}
	if string(buf) != "4567" {
		t.Fatalf("ReadFull() = %q, want %q", string(buf), "4567")
	}
}
