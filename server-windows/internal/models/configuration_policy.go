package models

import "time"

const (
	PolicyValueTypeDWORD        = "DWORD"
	PolicyValueTypeString       = "String"
	PolicyValueTypeExpandString = "ExpandString"
	PolicyValueTypeMultiString  = "MultiString"
	PolicyValueTypeBinary       = "Binary"
)

// ConfigurationPolicy is one registry policy rule attached to a configuration profile.
type ConfigurationPolicy struct {
	ID         uint      `gorm:"primaryKey"`
	ProfileID  uint      `gorm:"not null;index"`
	PolicyPath string    `gorm:"not null"`
	ValueType  string    `gorm:"not null"`
	Value      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (ConfigurationPolicy) TableName() string {
	return "configuration_policies"
}

// ConfigurationPolicyJSON is one registry policy for admin UI and agents.
type ConfigurationPolicyJSON struct {
	ID         uint   `json:"id,omitempty"`
	PolicyPath string `json:"policyPath" binding:"required"`
	ValueType  string `json:"valueType" binding:"required"`
	Value      string `json:"value"`
}

// ConfigurationPolicyListResponse is returned by GET /configurations/:id/policies.
type ConfigurationPolicyListResponse struct {
	Items []ConfigurationPolicyJSON `json:"items"`
}

// ReplaceConfigurationPoliciesRequest replaces all policies for one profile.
type ReplaceConfigurationPoliciesRequest struct {
	Items []ConfigurationPolicyJSON `json:"items" binding:"required"`
}

// DeviceConfigurationsResponse is returned to the agent for one device.
type DeviceConfigurationsResponse struct {
	ConfigurationID   uint                      `json:"configurationId,omitempty"`
	ConfigurationName string                    `json:"configurationName,omitempty"`
	Policies          []ConfigurationPolicyJSON `json:"policies"`
}

func NormalizePolicyValueType(raw string) string {
	switch raw {
	case PolicyValueTypeDWORD,
		PolicyValueTypeString,
		PolicyValueTypeExpandString,
		PolicyValueTypeMultiString,
		PolicyValueTypeBinary:
		return raw
	default:
		return PolicyValueTypeString
	}
}

func ToConfigurationPolicyJSON(policy ConfigurationPolicy) ConfigurationPolicyJSON {
	return ConfigurationPolicyJSON{
		ID:         policy.ID,
		PolicyPath: policy.PolicyPath,
		ValueType:  policy.ValueType,
		Value:      policy.Value,
	}
}
