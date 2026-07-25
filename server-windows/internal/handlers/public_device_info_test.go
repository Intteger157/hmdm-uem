package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
)

func TestParseUnsignedDeviceID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		input string
		want  uint
		ok    bool
	}{
		{input: "42", want: 42, ok: true},
		{input: " 7 ", want: 7, ok: true},
		{input: "0", ok: false},
		{input: "", ok: false},
		{input: "550e8400-e29b-41d4-a716-446655440000", ok: false},
		{input: "abc", ok: false},
	}

	for _, tc := range cases {
		got, ok := parseUnsignedDeviceID(tc.input)
		if ok != tc.ok {
			t.Fatalf("parseUnsignedDeviceID(%q) ok = %v, want %v", tc.input, ok, tc.ok)
		}
		if ok && got != tc.want {
			t.Fatalf("parseUnsignedDeviceID(%q) = %d, want %d", tc.input, got, tc.want)
		}
	}
}

func TestResolvePublicAgentVersionFromInstalledSoftware(t *testing.T) {
	t.Parallel()

	device := models.WindowsDevice{
		InstalledSoftware: []byte(`[{"name":"Singularity MDM Agent","version":"1.0.25"}]`),
	}

	got := resolvePublicAgentVersion(device)
	if got != "1.0.25" {
		t.Fatalf("resolvePublicAgentVersion() = %q, want %q", got, "1.0.25")
	}
}

func TestFormatPublicLastSync(t *testing.T) {
	t.Parallel()

	at := time.Date(2026, 7, 25, 10, 30, 0, 0, time.UTC)
	if got := formatPublicLastSync(at); got != "2026-07-25T10:30:00Z" {
		t.Fatalf("formatPublicLastSync() = %q", got)
	}
	if got := formatPublicLastSync(time.Time{}); got != "" {
		t.Fatalf("formatPublicLastSync(zero) = %q, want empty", got)
	}
}

func TestBuildPublicBaseURLUsesEnv(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "https://test-dev-mdm.intteger.uk")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	got := buildPublicBaseURL(c)
	if got != "https://test-dev-mdm.intteger.uk" {
		t.Fatalf("buildPublicBaseURL() = %q", got)
	}
}
