package models

import "testing"

func TestUpdateEnrollmentProvisioningRequestResolvedProvisioningEnabled(t *testing.T) {
	enabled := true
	disabled := false

	cases := []struct {
		name string
		req  UpdateEnrollmentProvisioningRequest
		want bool
	}{
		{
			name: "provisioningEnabled true",
			req: UpdateEnrollmentProvisioningRequest{
				ProvisioningEnabled: &enabled,
				CreateLocalAdmin:    false,
			},
			want: true,
		},
		{
			name: "provisioningEnabled false",
			req: UpdateEnrollmentProvisioningRequest{
				ProvisioningEnabled: &disabled,
				CreateLocalAdmin:    true,
			},
			want: false,
		},
		{
			name: "legacy createLocalAdmin",
			req: UpdateEnrollmentProvisioningRequest{
				CreateLocalAdmin: true,
			},
			want: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.req.ResolvedProvisioningEnabled(); got != tc.want {
				t.Fatalf("ResolvedProvisioningEnabled() = %t, want %t", got, tc.want)
			}
		})
	}
}
