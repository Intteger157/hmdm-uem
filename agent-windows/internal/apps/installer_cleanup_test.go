//go:build windows

package apps

import "testing"

func TestIsManagedInstallerProcessName(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		want bool
	}{
		{name: "singularity-mdm-app-3954209977.tmp", want: true},
		{name: "singularity-mdm-app-12345.exe", want: true},
		{name: "singularity-mdm-install-99.msi", want: false},
		{name: "singularity-agent.exe", want: false},
		{name: "setup.exe", want: false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := isManagedInstallerProcessName(tc.name); got != tc.want {
				t.Fatalf("isManagedInstallerProcessName(%q) = %v, want %v", tc.name, got, tc.want)
			}
		})
	}
}
