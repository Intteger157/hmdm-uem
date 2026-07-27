//go:build windows

package files

import (
	"fmt"
	"strings"
)

// DeploymentFingerprint returns a stable revision token for idempotency checks.
func DeploymentFingerprint(deployment RequiredFileDeployment) string {
	sha256 := strings.ToLower(strings.TrimSpace(deployment.SHA256))
	updatedAt := strings.TrimSpace(deployment.UpdatedAt)
	switch {
	case sha256 != "" && updatedAt != "":
		return sha256 + "@" + updatedAt
	case sha256 != "":
		return "sha:" + sha256
	case updatedAt != "":
		return "rev:" + updatedAt
	default:
		return fmt.Sprintf(
			"rule:%d:file:%d:size:%d:dest:%s",
			deployment.ID,
			deployment.FileID,
			deployment.SizeBytes,
			strings.TrimSpace(deployment.DestinationPath),
		)
	}
}

func appliedFileKey(fileID uint) string {
	return fmt.Sprintf("%d", fileID)
}
