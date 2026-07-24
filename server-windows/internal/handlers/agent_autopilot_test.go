package handlers

import (
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

func TestBuildAutopilotAgentStatusMissing(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("FILES_DIR", tempDir)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/rest/windows/autopilot-agent", nil)
	ctx.Request.Host = "test-dev-mdm.intteger.uk"
	ctx.Request.Header.Set("X-Forwarded-Proto", "https")

	status := buildAutopilotAgentStatus(ctx)
	if status.Configured {
		t.Fatal("expected configured=false")
	}
	if status.FileName != appstorage.AgentBinaryName {
		t.Fatalf("fileName = %q", status.FileName)
	}
}

func TestBuildAutopilotAgentStatusConfigured(t *testing.T) {
	tempDir := t.TempDir()
	t.Setenv("FILES_DIR", tempDir)

	if err := appstorage.EnsureAgentDirectory(); err != nil {
		t.Fatalf("ensure directory: %v", err)
	}
	if err := os.WriteFile(appstorage.AgentBinaryPath(), []byte("fake-agent"), 0o755); err != nil {
		t.Fatalf("write binary: %v", err)
	}
	uploadedAt := time.Date(2026, 3, 20, 12, 0, 0, 0, time.UTC)
	if err := appstorage.SaveAgentBinaryMeta(appstorage.AgentBinaryMeta{
		Version:    "1.0.25.0",
		UploadedAt: uploadedAt,
	}); err != nil {
		t.Fatalf("save metadata: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest("GET", "/rest/windows/autopilot-agent", nil)
	ctx.Request.Host = "test-dev-mdm.intteger.uk"
	ctx.Request.Header.Set("X-Forwarded-Proto", "https")

	status := buildAutopilotAgentStatus(ctx)
	if !status.Configured {
		t.Fatal("expected configured=true")
	}
	if status.Version != "1.0.25.0" {
		t.Fatalf("version = %q", status.Version)
	}
	if status.FileSize != int64(len("fake-agent")) {
		t.Fatalf("fileSize = %d", status.FileSize)
	}
	if !status.UploadedAt.Equal(uploadedAt) {
		t.Fatalf("uploadedAt = %v", status.UploadedAt)
	}
	if !strings.Contains(status.PublicURL, appstorage.AgentPublicPath()) {
		t.Fatalf("publicUrl = %q", status.PublicURL)
	}
}
