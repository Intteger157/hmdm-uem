//go:build windows

package apps

import "testing"

func TestCompareVersions(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		a, b string
		want int
	}{
		{name: "equal semver", a: "1.2.3", b: "1.2.3", want: 0},
		{name: "equal fold", a: "1.2.3-Beta", b: "1.2.3-beta", want: 0},
		{name: "newer patch", a: "1.2.4", b: "1.2.3", want: 1},
		{name: "older minor", a: "1.1.9", b: "1.2.0", want: -1},
		{name: "four segments", a: "24.1.0.5", b: "24.1.0.4", want: 1},
		{name: "prefix text", a: "v2.10.0", b: "v2.9.9", want: 1},
		{name: "local newer than expected", a: "3.0.0", b: "2.9.0", want: 1},
		{name: "empty left older", a: "", b: "1.0.0", want: -1},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := CompareVersions(tc.a, tc.b)
			if sign(got) != sign(tc.want) {
				t.Fatalf("CompareVersions(%q, %q) = %d, want sign of %d", tc.a, tc.b, got, tc.want)
			}
		})
	}
}

func sign(v int) int {
	switch {
	case v < 0:
		return -1
	case v > 0:
		return 1
	default:
		return 0
	}
}
