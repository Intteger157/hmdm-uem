package handlers

import (
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
