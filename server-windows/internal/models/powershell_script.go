package models

import "time"

const (
	PowerShellExecutionContextSystem = "System"
	PowerShellExecutionContextUser   = "User"
)

// PowerShellScript is one saved script in the library.
type PowerShellScript struct {
	ID               uint      `gorm:"primaryKey"`
	Name             string    `gorm:"not null"`
	Description      string
	Content          string    `gorm:"type:text;not null"`
	ExecutionContext string    `gorm:"not null;default:System"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (PowerShellScript) TableName() string {
	return "powershell_scripts"
}

// PowerShellScriptJSON is one script for the admin UI.
type PowerShellScriptJSON struct {
	ID               uint      `json:"id"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Content          string    `json:"content"`
	ExecutionContext string    `json:"executionContext"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// PowerShellScriptListResponse is returned by GET /scripts.
type PowerShellScriptListResponse struct {
	Items           []PowerShellScriptJSON `json:"items"`
	TotalItemsCount int64                  `json:"totalItemsCount"`
}

// UpsertPowerShellScriptRequest creates or updates a library script.
type UpsertPowerShellScriptRequest struct {
	Name             string `json:"name" binding:"required"`
	Description      string `json:"description"`
	Content          string `json:"content" binding:"required"`
	ExecutionContext string `json:"executionContext"`
}

func NormalizePowerShellExecutionContext(value string) string {
	switch value {
	case PowerShellExecutionContextUser:
		return PowerShellExecutionContextUser
	default:
		return PowerShellExecutionContextSystem
	}
}

func ToPowerShellScriptJSON(script PowerShellScript) PowerShellScriptJSON {
	return PowerShellScriptJSON{
		ID:               script.ID,
		Name:             script.Name,
		Description:      script.Description,
		Content:          script.Content,
		ExecutionContext: NormalizePowerShellExecutionContext(script.ExecutionContext),
		CreatedAt:        script.CreatedAt,
		UpdatedAt:        script.UpdatedAt,
	}
}
