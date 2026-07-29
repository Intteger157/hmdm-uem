package handlers

import (
	"testing"
	"time"

	"github.com/hmdm/server-windows/internal/models"
)

func TestShouldExcludeRequiredAppSuccessRevision(t *testing.T) {
	t.Parallel()

	baseTime := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	newerCatalog := baseTime.Add(time.Hour)

	app := models.RequiredApp{
		ID:        10,
		UpdatedAt: newerCatalog,
	}

	successWithoutRevision := models.DeviceAppStatus{
		AppID:  10,
		Status: models.AppStatusSuccess,
	}
	if shouldExcludeRequiredApp(app, successWithoutRevision) {
		t.Fatal("expected Success without catalog revision to remain required")
	}

	successCurrentRevision := models.DeviceAppStatus{
		AppID:                     10,
		Status:                    models.AppStatusSuccess,
		AttemptedCatalogUpdatedAt: ptrTime(newerCatalog),
	}
	if !shouldExcludeRequiredApp(app, successCurrentRevision) {
		t.Fatal("expected Success at current catalog revision to be excluded")
	}

	successOldRevision := models.DeviceAppStatus{
		AppID:                     10,
		Status:                    models.AppStatusSuccess,
		AttemptedCatalogUpdatedAt: ptrTime(baseTime),
	}
	if shouldExcludeRequiredApp(app, successOldRevision) {
		t.Fatal("expected Success with older catalog revision to remain required")
	}
}

func TestShouldExcludeRequiredAppFailedRevision(t *testing.T) {
	t.Parallel()

	baseTime := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	newerCatalog := baseTime.Add(time.Hour)

	app := models.RequiredApp{
		ID:        10,
		UpdatedAt: newerCatalog,
	}

	failedSameRevision := models.DeviceAppStatus{
		AppID:                     10,
		Status:                    models.AppStatusFailed,
		AttemptedCatalogUpdatedAt: ptrTime(baseTime),
	}
	appSameRevision := models.RequiredApp{ID: 10, UpdatedAt: baseTime}
	if !shouldExcludeRequiredApp(appSameRevision, failedSameRevision) {
		t.Fatal("expected Failed at same catalog revision to be excluded")
	}

	failedOldRevision := models.DeviceAppStatus{
		AppID:                     10,
		Status:                    models.AppStatusFailed,
		AttemptedCatalogUpdatedAt: ptrTime(baseTime),
	}
	if shouldExcludeRequiredApp(app, failedOldRevision) {
		t.Fatal("expected Failed with newer catalog revision to remain required")
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}

func TestProfilesFromAssignmentEntriesDedupesProfiles(t *testing.T) {
	t.Parallel()

	shared := models.WindowsConfigProfile{
		ID:   7,
		Name: "Shared",
		RequiredApps: []models.ProfileApp{
			{ProfileID: 7, AppID: 11},
		},
	}
	groupEntries := []profileAssignmentEntry{{Profile: shared, Source: models.AssignmentSourceGroup}}
	directEntries := []profileAssignmentEntry{{Profile: shared, Source: models.AssignmentSourceDirect}}

	profiles := profilesFromAssignmentEntries(groupEntries, directEntries)
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}
	if len(profiles[0].RequiredApps) != 1 || profiles[0].RequiredApps[0].AppID != 11 {
		t.Fatalf("expected preloaded required app on profile, got %+v", profiles[0].RequiredApps)
	}
}
