package handlers

import "testing"

func TestRemovedAppIDs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		previous []uint
		next     []uint
		want     []uint
	}{
		{
			name:     "no change",
			previous: []uint{1, 2, 3},
			next:     []uint{1, 2, 3},
			want:     nil,
		},
		{
			name:     "single removal",
			previous: []uint{1, 2, 3},
			next:     []uint{1, 3},
			want:     []uint{2},
		},
		{
			name:     "all removed",
			previous: []uint{1, 2},
			next:     nil,
			want:     []uint{1, 2},
		},
		{
			name:     "deduplicates removed ids",
			previous: []uint{1, 1, 2},
			next:     []uint{3},
			want:     []uint{1, 2},
		},
		{
			name:     "ignores zero ids",
			previous: []uint{0, 1},
			next:     nil,
			want:     []uint{1},
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := removedAppIDs(tc.previous, tc.next)
			if len(got) != len(tc.want) {
				t.Fatalf("removedAppIDs() = %#v, want %#v", got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("removedAppIDs() = %#v, want %#v", got, tc.want)
				}
			}
		})
	}
}
