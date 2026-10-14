package softwareversion

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
)

func TestCompareVersions(t *testing.T) {
	tests := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.0", 0},
		{"2.0", "1.9.9", 1},
		{"1.0", "2.0", -1},
		{"1.0.25.0", "1.0.25", 0},
	}
	for _, tc := range tests {
		got := Compare(tc.a, tc.b)
		if got != tc.want {
			t.Fatalf("Compare(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestEvaluateDrift(t *testing.T) {
	installed := []models.InstalledSoftwareRecord{
		{Name: "Example App", Version: "1.2.0"},
	}

	ver, dir, ok := EvaluateDrift("Example App", "1.2.0", installed)
	if !ok || ver != "1.2.0" || dir != "" {
		t.Fatalf("expected match, got ok=%v ver=%q dir=%q", ok, ver, dir)
	}

	ver, dir, ok = EvaluateDrift("Example App", "2.0.0", installed)
	if ok || dir != DriftLower || ver != "1.2.0" {
		t.Fatalf("expected lower drift, got ok=%v ver=%q dir=%q", ok, ver, dir)
	}

	ver, dir, ok = EvaluateDrift("Example App", "1.0.0", installed)
	if ok || dir != DriftHigher || ver != "1.2.0" {
		t.Fatalf("expected higher drift, got ok=%v ver=%q dir=%q", ok, ver, dir)
	}

	ver, dir, ok = EvaluateDrift("Missing App", "1.0.0", installed)
	if ok || dir != DriftLower || ver != "" {
		t.Fatalf("expected missing lower drift, got ok=%v ver=%q dir=%q", ok, ver, dir)
	}
}
