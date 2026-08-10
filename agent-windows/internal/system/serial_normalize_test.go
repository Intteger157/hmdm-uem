package system

import "testing"

func TestNormalizeSerial(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{"NXKHRSN00133011E477600", "NXKHRSN00133011E477600"},
		{"Chassis Serial Number", ""},
		{"  chassis serial number  ", ""},
		{"Base Board Serial Number", ""},
		{"System Serial Number", ""},
		{"To Be Filled By O.E.M.", ""},
		{"Default string", ""},
		{"123456789", ""},
		{"0123456789", ""},
		{"Not Specified", ""},
		{"N/A", ""},
	}

	for _, tc := range tests {
		got := normalizeSerial(tc.raw)
		if got != tc.want {
			t.Fatalf("normalizeSerial(%q) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}

func TestParseWMICSerialOutput(t *testing.T) {
	output := "SerialNumber\r\n\r\nNXKHRSN00133011E477600\r\n\r\n"
	got := parseWMICSerialOutput(output)
	if got != "NXKHRSN00133011E477600" {
		t.Fatalf("parseWMICSerialOutput() = %q", got)
	}
}

func TestParseWMICSerialOutputRejectsPlaceholder(t *testing.T) {
	output := "SerialNumber\r\n\r\nChassis Serial Number\r\n\r\n"
	if got := parseWMICSerialOutput(output); got != "" {
		t.Fatalf("parseWMICSerialOutput() = %q, want empty", got)
	}
}

func TestLooksLikeSerialLabel(t *testing.T) {
	if !looksLikeSerialLabel("Chassis Serial Number") {
		t.Fatal("expected Chassis Serial Number to be treated as label")
	}
	if looksLikeSerialLabel("NXKHRSN00133011E477600") {
		t.Fatal("expected real serial with digits not to be treated as label")
	}
}
