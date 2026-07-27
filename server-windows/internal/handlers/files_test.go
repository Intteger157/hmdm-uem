package handlers

import "testing"

func TestParseForceDeleteQuery(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  bool
	}{
		{input: "true", want: true},
		{input: "TRUE", want: true},
		{input: "1", want: true},
		{input: "yes", want: true},
		{input: "false", want: false},
		{input: "", want: false},
	}

	for _, tc := range tests {
		if got := parseForceDeleteQuery(tc.input); got != tc.want {
			t.Fatalf("parseForceDeleteQuery(%q) = %v, want %v", tc.input, got, tc.want)
		}
	}
}
