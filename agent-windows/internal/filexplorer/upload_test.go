//go:build windows

package filexplorer

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUploadDestinationCollectsBinaryChunks(t *testing.T) {
	dir := t.TempDir()
	targetPath := filepath.Join(dir, "uploaded.bin")

	file, err := openUploadDestination(targetPath)
	if err != nil {
		t.Fatalf("openUploadDestination: %v", err)
	}

	chunks := [][]byte{
		[]byte("hello "),
		[]byte("world"),
	}
	for _, chunk := range chunks {
		if err := writeUploadChunk(file, chunk); err != nil {
			t.Fatalf("writeUploadChunk: %v", err)
		}
	}
	if err := closeUploadDestination(file); err != nil {
		t.Fatalf("closeUploadDestination: %v", err)
	}

	data, err := os.ReadFile(targetPath)
	if err != nil {
		t.Fatalf("read uploaded file: %v", err)
	}
	if string(data) != "hello world" {
		t.Fatalf("uploaded content = %q want %q", string(data), "hello world")
	}
}

func TestStartExecutableMissingFile(t *testing.T) {
	err := startExecutable(`C:\does-not-exist\upload-exec-test.exe`)
	if err == nil {
		t.Fatal("expected error for missing executable")
	}
}

func TestStartExecutableRejectsDirectory(t *testing.T) {
	err := startExecutable(os.TempDir())
	if err == nil {
		t.Fatal("expected error when path is a directory")
	}
}

func TestParseUploadCommands(t *testing.T) {
	startCmd, err := parseIncomingCommand([]byte(`{"action":"upload_start","path":"C:\\Temp\\setup.exe"}`))
	if err != nil {
		t.Fatalf("parse upload_start: %v", err)
	}
	if startCmd.Action != ActionUploadStart || startCmd.Path != `C:\Temp\setup.exe` {
		t.Fatalf("unexpected command: %+v", startCmd)
	}

	endCmd, err := parseIncomingCommand([]byte(`{"action":"upload_end"}`))
	if err != nil {
		t.Fatalf("parse upload_end: %v", err)
	}
	if endCmd.Action != ActionUploadEnd {
		t.Fatalf("action = %q want %q", endCmd.Action, ActionUploadEnd)
	}

	execCmd, err := parseIncomingCommand([]byte(`{"action":"execute","path":"C:\\Temp\\setup.exe"}`))
	if err != nil {
		t.Fatalf("parse execute: %v", err)
	}
	if execCmd.Action != ActionExecute {
		t.Fatalf("action = %q want %q", execCmd.Action, ActionExecute)
	}
}
