package models

import (
	"testing"
	"time"
)

func TestEffectiveConfigHashStableForSameInput(t *testing.T) {
	t.Parallel()

	updatedAt := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	cfg := EffectiveConfigResponse{
		Payload: WindowsConfigProfilePayload{
			DefenderEnabled:   true,
			BlockUsbStorage:   false,
			UsbReadOnly:       true,
			ScreenLockTimeout: 300,
		},
		RequiredApps: []RequiredApp{
			{
				ID:          1,
				Name:        "Telegram",
				Version:     "5.0",
				UpdatedAt:   updatedAt,
				DownloadURL: "/rest/windows/apps/1/download",
				AppType:     "upload",
			},
		},
		ProfileID:   7,
		ProfileName: "Default",
		Source:      AssignmentSourceDirect,
	}

	first := EffectiveConfigHash(cfg)
	second := EffectiveConfigHash(cfg)
	if first == "" {
		t.Fatal("expected non-empty hash")
	}
	if first != second {
		t.Fatalf("expected stable hash, got %q and %q", first, second)
	}
}

func TestEffectiveConfigHashChangesWhenAppsChange(t *testing.T) {
	t.Parallel()

	base := EffectiveConfigResponse{
		Payload:     WindowsConfigProfilePayload{DefenderEnabled: true},
		ProfileID:   1,
		ProfileName: "Default",
		Source:      AssignmentSourceDirect,
	}

	withApp := base
	withApp.RequiredApps = []RequiredApp{{ID: 1, Name: "App A"}}

	withoutApp := base
	if EffectiveConfigHash(withApp) == EffectiveConfigHash(withoutApp) {
		t.Fatal("expected hash to change when required apps change")
	}
}

func TestEffectiveConfigHashEmptyPolicy(t *testing.T) {
	t.Parallel()

	if got := EffectiveConfigHash(EffectiveConfigResponse{}); got != emptyEffectiveConfigHash {
		t.Fatalf("expected %q, got %q", emptyEffectiveConfigHash, got)
	}
}
