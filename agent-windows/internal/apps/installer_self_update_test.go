//go:build windows

package apps

import "testing"

func TestIsAgentSelfUpdatePackage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		want bool
	}{
		{name: "Singularity MDM Agent", want: true},
		{name: "singularity mdm agent", want: true},
		{name: "SingularityMDMAgent", want: true},
		{name: "Google Chrome", want: false},
		{name: "", want: false},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := isAgentSelfUpdatePackage(tc.name); got != tc.want {
				t.Fatalf("isAgentSelfUpdatePackage(%q) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}
