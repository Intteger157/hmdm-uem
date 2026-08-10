package handlers

import "testing"

func TestWindowsDeviceSortExpr(t *testing.T) {
	tests := []struct {
		sortBy string
		sortDir string
		want    string
	}{
		{"HOSTNAME", "ASC", "LOWER(COALESCE(NULLIF(hostname, ''), hardware_id)) ASC NULLS LAST, LOWER(hardware_id) ASC"},
		{"LAST_UPDATE", "DESC", "last_checkin DESC NULLS LAST, LOWER(hardware_id) ASC"},
		{"", "", "LOWER(COALESCE(NULLIF(hostname, ''), hardware_id)) ASC NULLS LAST, LOWER(hardware_id) ASC"},
	}

	for _, tc := range tests {
		got := windowsDeviceSortExpr(tc.sortBy, tc.sortDir)
		if got != tc.want {
			t.Fatalf("windowsDeviceSortExpr(%q, %q) = %q, want %q", tc.sortBy, tc.sortDir, got, tc.want)
		}
	}
}
