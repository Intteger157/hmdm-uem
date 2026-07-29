//go:build windows

package filexplorer

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestBuildDirListResponse(t *testing.T) {
	dir := t.TempDir()
	filePath := filepath.Join(dir, "notes.txt")
	if err := os.WriteFile(filePath, []byte("hello"), 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}
	subdir := filepath.Join(dir, "nested")
	if err := os.Mkdir(subdir, 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	resp, err := buildDirListResponse(dir)
	if err != nil {
		t.Fatalf("buildDirListResponse: %v", err)
	}
	if resp.Type != MessageTypeDirList {
		t.Fatalf("type = %q want %q", resp.Type, MessageTypeDirList)
	}
	if resp.Path != dir {
		t.Fatalf("path = %q want %q", resp.Path, dir)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("items len = %d want 2", len(resp.Items))
	}

	byName := map[string]dirListItem{}
	for _, item := range resp.Items {
		byName[item.Name] = item
	}

	fileItem, ok := byName["notes.txt"]
	if !ok {
		t.Fatal("missing notes.txt entry")
	}
	if fileItem.IsDir {
		t.Fatal("notes.txt should not be a directory")
	}
	if fileItem.Size != 5 {
		t.Fatalf("notes.txt size = %d want 5", fileItem.Size)
	}
	if _, err := time.Parse(time.RFC3339, fileItem.ModTime); err != nil {
		t.Fatalf("invalid mod_time: %v", err)
	}

	dirItem, ok := byName["nested"]
	if !ok {
		t.Fatal("missing nested entry")
	}
	if !dirItem.IsDir {
		t.Fatal("nested should be a directory")
	}
	if dirItem.Size != 0 {
		t.Fatalf("directory size = %d want 0", dirItem.Size)
	}
}

func TestPublicErrorMessageAccessDenied(t *testing.T) {
	err := os.ErrPermission
	if got := publicErrorMessage(err); got != "Access denied" {
		t.Fatalf("got %q want Access denied", got)
	}
}

func TestParseIncomingCommand(t *testing.T) {
	cmd, err := parseIncomingCommand([]byte(`{"action":"read_dir","path":"C:\\Windows"}`))
	if err != nil {
		t.Fatalf("parseIncomingCommand: %v", err)
	}
	if cmd.Action != ActionReadDir || cmd.Path != `C:\Windows` {
		t.Fatalf("unexpected command: %+v", cmd)
	}
}
