package models

import (
	"encoding/json"
	"testing"
)

func TestRequiredAppRequestUnmarshalCamelCase(t *testing.T) {
	t.Parallel()

	var item RequiredAppRequest
	if err := json.Unmarshal([]byte(`{"appId":5,"versionPolicy":"latest"}`), &item); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if item.AppID != 5 || item.VersionPolicy != VersionPolicyLatest {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func TestRequiredAppRequestUnmarshalSnakeCase(t *testing.T) {
	t.Parallel()

	var item RequiredAppRequest
	if err := json.Unmarshal([]byte(`{"app_id":7,"version_policy":"42"}`), &item); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if item.AppID != 7 || item.VersionPolicy != "42" {
		t.Fatalf("unexpected item: %+v", item)
	}
}

func TestRequiredAppRequestUnmarshalLegacyVersionIDNull(t *testing.T) {
	t.Parallel()

	var item RequiredAppRequest
	if err := json.Unmarshal([]byte(`{"appId":3,"versionId":null}`), &item); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	assignment, err := item.ToAssignment()
	if err != nil {
		t.Fatalf("to assignment failed: %v", err)
	}
	if assignment.AppID != 3 || assignment.VersionID != nil {
		t.Fatalf("unexpected assignment: %+v", assignment)
	}
}

func TestUpsertConfigProfileRequestUnmarshalRequiredAppsSnakeCase(t *testing.T) {
	t.Parallel()

	var req UpsertConfigProfileRequest
	payload := `{
		"name": "Default",
		"payload": {"defenderEnabled": true, "blockUsbStorage": false, "usbReadOnly": false, "screenLockTimeout": 0},
		"required_apps": [
			{"app_id": 1, "version_policy": "latest"},
			{"app_id": 2, "version_policy": "15"}
		]
	}`
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	assignments, err := req.NormalizedAssignments()
	if err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if len(assignments) != 2 {
		t.Fatalf("expected 2 assignments, got %d", len(assignments))
	}
	if assignments[0].VersionID != nil {
		t.Fatalf("expected latest policy to leave version unset")
	}
	if assignments[1].VersionID == nil || *assignments[1].VersionID != 15 {
		t.Fatalf("expected pinned version 15, got %+v", assignments[1])
	}
}

func TestUpsertConfigProfileRequestUnmarshalLegacyAssignmentsNullVersion(t *testing.T) {
	t.Parallel()

	var req UpsertConfigProfileRequest
	payload := `{
		"name": "Default",
		"payload": {"defenderEnabled": true, "blockUsbStorage": false, "usbReadOnly": false, "screenLockTimeout": 0},
		"assignments": [
			{"appId": 4, "versionId": null},
			{"appId": 5, "versionId": 9}
		]
	}`
	if err := json.Unmarshal([]byte(payload), &req); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	assignments, err := req.NormalizedAssignments()
	if err != nil {
		t.Fatalf("normalize failed: %v", err)
	}
	if len(assignments) != 2 {
		t.Fatalf("expected 2 assignments, got %d", len(assignments))
	}
	if assignments[0].VersionID != nil {
		t.Fatalf("expected null versionId to remain unset")
	}
	if assignments[1].VersionID == nil || *assignments[1].VersionID != 9 {
		t.Fatalf("expected version 9, got %+v", assignments[1])
	}
}
