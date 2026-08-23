package handlers

import (
	"testing"
	"time"

	"github.com/hmdm/server-windows/internal/models"
)

func TestResolveDashboardPlatformFilter(t *testing.T) {
	t.Parallel()

	androidOnly, windowsOnly := resolveDashboardPlatformFilter("android", true, true)
	if !androidOnly || windowsOnly {
		t.Fatalf("android filter = (%v, %v), want (true, false)", androidOnly, windowsOnly)
	}

	androidOnly, windowsOnly = resolveDashboardPlatformFilter("windows", true, true)
	if androidOnly || !windowsOnly {
		t.Fatalf("windows filter = (%v, %v), want (false, true)", androidOnly, windowsOnly)
	}

	androidOnly, windowsOnly = resolveDashboardPlatformFilter("", true, true)
	if !androidOnly || !windowsOnly {
		t.Fatalf("combined filter = (%v, %v), want (true, true)", androidOnly, windowsOnly)
	}

	androidOnly, windowsOnly = resolveDashboardPlatformFilter("android", false, true)
	if androidOnly || windowsOnly {
		t.Fatalf("scoped android filter = (%v, %v), want (false, false)", androidOnly, windowsOnly)
	}
}

func TestAndroidConnectivityBucket(t *testing.T) {
	t.Parallel()
	now := time.Unix(1_700_000_000_000, 0).UTC()

	green := now.Add(-5 * time.Minute).UnixMilli()
	yellow := now.Add(-90 * time.Minute).UnixMilli()
	red := now.Add(-5 * time.Hour).UnixMilli()

	if got := androidConnectivityBucket(&green, now); got != "green" {
		t.Fatalf("green bucket = %q", got)
	}
	if got := androidConnectivityBucket(&yellow, now); got != "yellow" {
		t.Fatalf("yellow bucket = %q", got)
	}
	if got := androidConnectivityBucket(&red, now); got != "red" {
		t.Fatalf("red bucket = %q", got)
	}
	if got := androidConnectivityBucket(nil, now); got != "grey" {
		t.Fatalf("nil bucket = %q", got)
	}
}

func TestWindowsConnectivityBucket(t *testing.T) {
	t.Parallel()
	now := time.Unix(1_700_000_000_000, 0).UTC()

	active := models.WindowsDevice{
		AgentStatus: models.AgentStatusActive,
		LastCheckin: now.Add(-10 * time.Minute),
	}
	if got := windowsConnectivityBucket(active, now); got != "green" {
		t.Fatalf("active bucket = %q", got)
	}

	uninstalled := models.WindowsDevice{AgentStatus: models.AgentStatusUninstalled}
	if got := windowsConnectivityBucket(uninstalled, now); got != "brown" {
		t.Fatalf("uninstalled bucket = %q", got)
	}
}

func TestRankDashboardAttentionDevices(t *testing.T) {
	t.Parallel()

	items := []models.DashboardAttentionDevice{
		{Platform: "android", Number: "a", StatusCode: "yellow"},
		{Platform: "windows", Number: "w", StatusCode: "red"},
		{Platform: "android", Number: "b", StatusCode: "brown"},
	}
	ranked := rankDashboardAttentionDevices(items, 2)
	if len(ranked) != 2 {
		t.Fatalf("len = %d, want 2", len(ranked))
	}
	if ranked[0].StatusCode != "brown" || ranked[1].StatusCode != "red" {
		t.Fatalf("unexpected ranking: %#v", ranked)
	}
}
