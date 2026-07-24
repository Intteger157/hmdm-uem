package handlers

import (
	"testing"
	"time"

	"github.com/hmdm/server-windows/internal/models"
)

func TestShouldExcludeRequiredApp(t *testing.T) {
	t.Parallel()

	baseTime := time.Date(2026, 7, 22, 12, 0, 0, 0, time.UTC)
	newerCatalog := baseTime.Add(time.Hour)

	app := models.RequiredApp{
		ID:        10,
		UpdatedAt: newerCatalog,
	}

	successStatus := models.DeviceAppStatus{
		AppID:  10,
		Status: models.AppStatusSuccess,
	}
	if !shouldExcludeRequiredApp(app, successStatus) {
		t.Fatal("expected Success to be excluded from required apps")
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

	failedMissingRevision := models.DeviceAppStatus{
		AppID:  10,
		Status: models.AppStatusFailed,
	}
	if !shouldExcludeRequiredApp(app, failedMissingRevision) {
		t.Fatal("expected Failed without catalog revision metadata to be excluded")
	}
}

func ptrTime(value time.Time) *time.Time {
	return &value
}
