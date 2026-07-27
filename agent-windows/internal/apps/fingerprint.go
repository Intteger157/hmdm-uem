//go:build windows

package apps

import (
	"fmt"
	"strings"
)

// AppDeploymentFingerprint returns a stable revision token for idempotency checks.
func AppDeploymentFingerprint(app RequiredApp) string {
	updatedAt := strings.TrimSpace(app.UpdatedAt)
	version := strings.TrimSpace(app.Version)
	wingetID := strings.TrimSpace(app.WingetID)
	switch {
	case updatedAt != "" && version != "":
		return version + "@" + updatedAt
	case updatedAt != "":
		return "rev:" + updatedAt
	case version != "":
		return "ver:" + version
	case wingetID != "":
		return "winget:" + strings.ToLower(wingetID)
	default:
		return fmt.Sprintf("app:%d:name:%s", app.ID, strings.ToLower(strings.TrimSpace(app.Name)))
	}
}
