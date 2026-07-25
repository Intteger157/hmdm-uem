package models

// CheckinResponse is returned by POST /rest/windows/checkin.
type CheckinResponse struct {
	ConfigHash    string `json:"configHash,omitempty"`
	ConfigChanged bool   `json:"configChanged,omitempty"`
}
