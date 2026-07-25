package handlers

import (
	"testing"
)

func TestNormalizeAssignmentTargetIDsDropsZeroAndDuplicates(t *testing.T) {
	t.Parallel()

	got := normalizeAssignmentTargetIDs([]uint{0, 5, 5, 0, 9})
	if len(got) != 2 || got[0] != 5 || got[1] != 9 {
		t.Fatalf("unexpected normalized ids: %#v", got)
	}
}

func TestValidateAssignmentTargetsAllowsEmptyAfterNormalization(t *testing.T) {
	t.Parallel()

	if err := validateAssignmentTargets([]uint{0, 0}, nil); err != nil {
		t.Fatalf("expected empty assignments to pass, got %v", err)
	}
}
