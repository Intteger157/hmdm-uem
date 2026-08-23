package models

// CheckinRequest is the optional JSON body for POST /rest/windows/checkin.
type CheckinRequest struct {
	AgentVersion string `json:"agent_version"`
}

// CheckinResponse is returned by POST /rest/windows/checkin.
type CheckinResponse struct {
	ConfigHash    string `json:"configHash,omitempty"`
	ConfigChanged bool   `json:"configChanged,omitempty"`
}
