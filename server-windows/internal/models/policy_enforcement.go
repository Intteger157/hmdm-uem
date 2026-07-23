package models

const CommandNamePolicyEnforcement = "PolicyEnforcement"

// ReportPolicyEnforcementRequest is posted by the agent after enforcing policies.
type ReportPolicyEnforcementRequest struct {
	Success bool   `json:"success"`
	Output  string `json:"output"`
}
