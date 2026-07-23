package handlers

import (
	"fmt"
	"strings"

	"github.com/hmdm/server-windows/internal/models"
)

func normalizeAppType(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case models.AppTypeUpload:
		return models.AppTypeUpload
	case models.AppTypeWinget:
		return models.AppTypeWinget
	default:
		return models.AppTypeURL
	}
}

func applyUpsertRequest(app *models.SoftwareApp, req models.UpsertSoftwareAppRequest) error {
	appType := normalizeAppType(req.AppType)
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return fmt.Errorf("name is required")
	}

	app.Name = name
	app.Version = strings.TrimSpace(req.Version)
	app.InstallArgs = strings.TrimSpace(req.InstallArgs)
	app.AppType = appType
	app.WingetID = strings.TrimSpace(req.WingetID)
	app.AutoUpdate = req.AutoUpdate
	app.UpdateFrequency = strings.ToLower(strings.TrimSpace(req.UpdateFrequency))

	switch appType {
	case models.AppTypeWinget:
		if app.WingetID == "" {
			return fmt.Errorf("wingetId is required for winget apps")
		}
		app.DownloadURL = strings.TrimSpace(req.DownloadURL)
	case models.AppTypeUpload, models.AppTypeURL:
		downloadURL := strings.TrimSpace(req.DownloadURL)
		if downloadURL == "" {
			return fmt.Errorf("downloadUrl is required")
		}
		app.DownloadURL = downloadURL
		app.WingetID = ""
	}

	if appType == models.AppTypeUpload {
		app.AutoUpdate = false
		app.UpdateFrequency = ""
	}

	if app.AutoUpdate {
		switch app.UpdateFrequency {
		case models.UpdateFrequencyDaily, models.UpdateFrequencyWeekly:
		default:
			return fmt.Errorf("updateFrequency must be daily or weekly when autoUpdate is enabled")
		}
	} else {
		app.UpdateFrequency = ""
	}

	return nil
}
