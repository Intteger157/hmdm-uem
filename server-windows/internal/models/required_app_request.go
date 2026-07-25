package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const VersionPolicyLatest = "latest"

var garbageVersionPolicyMarkers = []string{
	"{version}",
	"{{version}}",
	"latest (",
	"последняя (",
}

func normalizeVersionPolicy(raw string) string {
	policy := strings.TrimSpace(strings.ToLower(raw))
	if policy == "" {
		return VersionPolicyLatest
	}

	for _, marker := range garbageVersionPolicyMarkers {
		if strings.Contains(policy, marker) {
			return VersionPolicyLatest
		}
	}

	if policy == VersionPolicyLatest {
		return VersionPolicyLatest
	}

	versionID, err := strconv.ParseUint(policy, 10, 64)
	if err != nil || versionID == 0 {
		return VersionPolicyLatest
	}

	return strconv.FormatUint(versionID, 10)
}

// RequiredAppRequest is one required app entry from profile upsert APIs.
type RequiredAppRequest struct {
	AppID         uint
	VersionPolicy string
}

// UnmarshalJSON accepts camelCase and snake_case keys plus legacy versionId.
func (r *RequiredAppRequest) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	appID, err := readUintField(raw, "appId", "app_id")
	if err != nil {
		return err
	}
	r.AppID = appID

	policy, err := readStringField(raw, "versionPolicy", "version_policy")
	if err != nil {
		return err
	}
	if policy != "" {
		r.VersionPolicy = normalizeVersionPolicy(policy)
		return nil
	}

	versionID, hasVersionID, err := readOptionalUintField(raw, "versionId", "version_id")
	if err != nil {
		return err
	}
	if hasVersionID && versionID > 0 {
		r.VersionPolicy = strconv.FormatUint(uint64(versionID), 10)
		return nil
	}

	r.VersionPolicy = VersionPolicyLatest
	return nil
}

func (r RequiredAppRequest) ToAssignment() (ProfileAppAssignment, error) {
	if r.AppID == 0 {
		return ProfileAppAssignment{}, fmt.Errorf("app id is required")
	}

	policy := normalizeVersionPolicy(r.VersionPolicy)
	if policy == VersionPolicyLatest {
		return ProfileAppAssignment{AppID: r.AppID}, nil
	}

	versionID, err := strconv.ParseUint(policy, 10, 64)
	if err != nil || versionID == 0 {
		return ProfileAppAssignment{AppID: r.AppID}, nil
	}

	pinned := uint(versionID)
	return ProfileAppAssignment{AppID: r.AppID, VersionID: &pinned}, nil
}

func NormalizeRequiredAppRequests(items []RequiredAppRequest) ([]ProfileAppAssignment, error) {
	assignments := make([]ProfileAppAssignment, 0, len(items))
	for _, item := range items {
		assignment, err := item.ToAssignment()
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, assignment)
	}
	return dedupeProfileAssignments(assignments), nil
}

func dedupeProfileAssignments(items []ProfileAppAssignment) []ProfileAppAssignment {
	seen := make(map[uint]struct{})
	result := make([]ProfileAppAssignment, 0, len(items))
	for _, item := range items {
		if item.AppID == 0 {
			continue
		}
		if _, ok := seen[item.AppID]; ok {
			continue
		}
		seen[item.AppID] = struct{}{}
		result = append(result, item)
	}
	return result
}

func readUintField(raw map[string]json.RawMessage, keys ...string) (uint, error) {
	for _, key := range keys {
		value, ok := raw[key]
		if !ok || len(value) == 0 {
			continue
		}
		if string(value) == "null" {
			continue
		}

		var parsed uint64
		if err := json.Unmarshal(value, &parsed); err != nil {
			return 0, fmt.Errorf("%s must be a positive integer", key)
		}
		return uint(parsed), nil
	}
	return 0, nil
}

func readStringField(raw map[string]json.RawMessage, keys ...string) (string, error) {
	for _, key := range keys {
		value, ok := raw[key]
		if !ok || len(value) == 0 || string(value) == "null" {
			continue
		}

		var parsed string
		if err := json.Unmarshal(value, &parsed); err != nil {
			return "", fmt.Errorf("%s must be a string", key)
		}
		return strings.TrimSpace(parsed), nil
	}
	return "", nil
}

func readOptionalUintField(raw map[string]json.RawMessage, keys ...string) (uint, bool, error) {
	for _, key := range keys {
		value, ok := raw[key]
		if !ok {
			continue
		}
		if string(value) == "null" {
			return 0, true, nil
		}

		var parsed uint64
		if err := json.Unmarshal(value, &parsed); err != nil {
			return 0, false, fmt.Errorf("%s must be a positive integer or null", key)
		}
		return uint(parsed), true, nil
	}
	return 0, false, nil
}
