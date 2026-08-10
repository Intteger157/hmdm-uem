package models

import "testing"

func TestSanitizeSerialNumber(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"NXKHRSN00133011E477600", "NXKHRSN00133011E477600"},
		{"Chassis Serial Number", ""},
		{"System Serial Number", ""},
	}

	for _, tc := range tests {
		if got := SanitizeSerialNumber(tc.raw); got != tc.want {
			t.Fatalf("SanitizeSerialNumber(%q) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}
