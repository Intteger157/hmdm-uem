package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/middleware"
	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/softwareversion"
)

func requiredAppPolicyVersion(app models.RequiredApp) string {
	if v := strings.TrimSpace(app.ExpectedVersion); v != "" {
		return v
	}
	return strings.TrimSpace(app.Version)
}

func windowsDeviceDisplayName(device models.WindowsDevice) string {
	if name := strings.TrimSpace(device.Hostname); name != "" {
		return name
	}
	if name := strings.TrimSpace(device.Model); name != "" {
		return name
	}
	return device.HardwareID
}

func collectWindowsAppVersionDrifts(limit int) ([]models.DashboardAppVersionMismatch, int64, int64, error) {
	var devices []models.WindowsDevice
	if err := db.DB.Find(&devices).Error; err != nil {
		return nil, 0, 0, err
	}

	items := make([]models.DashboardAppVersionMismatch, 0)
	deviceDrift := make(map[uint]struct{})

	for _, device := range devices {
		if device.AgentStatus == models.AgentStatusUninstalled {
			continue
		}

		effective, err := buildEffectiveConfigForDevice(device, true)
		if err != nil {
			return nil, 0, 0, err
		}
		if len(effective.RequiredApps) == 0 {
			continue
		}

		installed := models.DecodeInstalledSoftwareRecords(device.InstalledSoftware)
		displayName := windowsDeviceDisplayName(device)
		profileName := strings.TrimSpace(effective.ProfileName)

		for _, app := range effective.RequiredApps {
			expected := requiredAppPolicyVersion(app)
			if expected == "" {
				continue
			}

			installedVersion, direction, ok := softwareversion.EvaluateDrift(app.Name, expected, installed)
			if ok {
				continue
			}

			deviceDrift[device.ID] = struct{}{}
			items = append(items, models.DashboardAppVersionMismatch{
				Platform:         "windows",
				DeviceHardwareID: device.HardwareID,
				DeviceDisplayName: displayName,
				ProfileName:      profileName,
				AppID:            app.ID,
				AppName:          app.Name,
				ExpectedVersion:  expected,
				InstalledVersion: installedVersion,
				Direction:        string(direction),
			})
		}
	}

	sortAppVersionMismatches(items)

	totalRows := int64(len(items))
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}

	return items, totalRows, int64(len(deviceDrift)), nil
}

func sortAppVersionMismatches(items []models.DashboardAppVersionMismatch) {
	rankDirection := func(direction string) int {
		switch direction {
		case string(softwareversion.DriftLower):
			return 0
		case string(softwareversion.DriftHigher):
			return 1
		default:
			return 2
		}
	}

	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			ri := rankDirection(items[i].Direction)
			rj := rankDirection(items[j].Direction)
			if rj < ri ||
				(rj == ri && strings.ToLower(items[j].DeviceDisplayName) < strings.ToLower(items[i].DeviceDisplayName)) ||
				(rj == ri && items[j].DeviceDisplayName == items[i].DeviceDisplayName &&
					strings.ToLower(items[j].AppName) < strings.ToLower(items[i].AppName)) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}
}

// GetDashboardAppVersionMismatches lists Windows devices where inventory version differs from policy.
func (h *WindowsHandler) GetDashboardAppVersionMismatches(c *gin.Context) {
	_, userOK := middleware.CurrentUser(c)
	if !userOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, roleOK := middleware.CurrentRole(c)
	if !roleOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	includeAndroid, includeWindows := resolveDashboardPlatformFilter(c.Query("platform"), role.AllowsPlatform(models.PlatformScopeAndroid), role.AllowsPlatform(models.PlatformScopeWindows))

	limit := 200
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 500 {
			limit = parsed
		}
	}

	response := models.DashboardAppVersionMismatchesResponse{
		Sources: models.DashboardSummarySources{
			Android: includeAndroid,
			Windows: includeWindows,
		},
	}

	if !includeWindows {
		c.JSON(http.StatusOK, response)
		return
	}

	items, totalRows, deviceCount, err := collectWindowsAppVersionDrifts(limit)
	if err != nil {
		log.Printf("[dashboard-app-version-mismatches] aggregation failed: err=%v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load version mismatches"})
		return
	}

	response.Items = items
	response.TotalRows = totalRows
	response.DevicesAffected = deviceCount
	c.JSON(http.StatusOK, response)
}
