//go:build windows

package apps

import (
	"fmt"
	"strings"

	"github.com/hmdm/agent-windows/internal/system"
)

// EvaluateRequiredApp returns one evaluation report line for a required application.
func EvaluateRequiredApp(app RequiredApp, state AppsState, installed []system.InstalledSoftwareInfo) string {
	name := displayAppName(app)
	if state.ShouldSkipDeploy(app) {
		return fmt.Sprintf("- App [%s]: Already deployed", name)
	}
	if normalizeAppType(app.AppType) == AppTypeWinget {
		wingetID := strings.TrimSpace(app.WingetID)
		if wingetID != "" {
			present, err := isWingetInstalled(wingetID)
			if err == nil && present {
				return fmt.Sprintf("- App [%s]: Already installed", name)
			}
		}
		return fmt.Sprintf("- App [%s]: Queued for installation", name)
	}
	if isAppInstalled(app.Name, app.Version, installed) {
		return fmt.Sprintf("- App [%s]: Already installed", name)
	}
	return fmt.Sprintf("- App [%s]: Queued for installation", name)
}

func displayAppName(app RequiredApp) string {
	name := strings.TrimSpace(app.Name)
	if name == "" {
		return fmt.Sprintf("App #%d", app.ID)
	}
	return name
}
