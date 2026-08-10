package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/middleware"
	"github.com/hmdm/server-windows/internal/models"
)

const (
	dashboardOnlineGreenMs  = 20 * 60 * 1000
	dashboardOnlineYellowMs = 2 * 60 * 60 * 1000
)

type dashboardStatusCounts struct {
	Green  int64
	Yellow int64
	Red    int64
	Grey   int64
	Brown  int64
}

type dashboardInstallCounts struct {
	Success         int64
	VersionMismatch int64
	Failure         int64
}

type partialDashboardSummary struct {
	Total             int64
	Enrolled          int64
	EnrolledLastMonth int64
	Status            dashboardStatusCounts
	Install           dashboardInstallCounts
}

// GetDashboardSummary aggregates Android and Windows fleet KPIs for the unified console dashboard.
func (h *WindowsHandler) GetDashboardSummary(c *gin.Context) {
	user, userOK := middleware.CurrentUser(c)
	if !userOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, roleOK := middleware.CurrentRole(c)
	if !roleOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	includeAndroid := role.AllowsPlatform(models.PlatformScopeAndroid)
	includeWindows := role.AllowsPlatform(models.PlatformScopeWindows)

	accumulator := partialDashboardSummary{}
	response := models.DashboardSummaryResponse{
		DevicesEnrolledMonthly: []models.ChartItem{},
		TopConfigs:             []string{},
		Sources: models.DashboardSummarySources{
			Android: includeAndroid,
			Windows: includeWindows,
		},
	}

	customerID := user.CustomerID
	if customerID <= 0 {
		customerID = 1
	}
	now := time.Now().UTC()

	if includeAndroid {
		androidSummary, err := loadAndroidDashboardSummary(user, customerID, now)
		if err != nil {
			log.Printf("[dashboard-summary] android aggregation failed: user_id=%d err=%v", user.ID, err)
			response.Warnings = append(response.Warnings, "android data unavailable")
			response.Sources.Android = false
		} else {
			mergePartialDashboardSummary(&accumulator, androidSummary)
		}
	}

	if includeWindows {
		windowsSummary, err := loadWindowsDashboardSummary(now)
		if err != nil {
			log.Printf("[dashboard-summary] windows aggregation failed: err=%v", err)
			response.Warnings = append(response.Warnings, "windows data unavailable")
			response.Sources.Windows = false
		} else {
			mergePartialDashboardSummary(&accumulator, windowsSummary)
		}
	}

	response.DevicesTotal = accumulator.Total
	response.DevicesEnrolled = accumulator.Enrolled
	response.DevicesEnrolledLastMonth = accumulator.EnrolledLastMonth
	response.StatusSummary = buildStatusChartItems(accumulator.Status)
	response.InstallSummary = buildInstallChartItems(accumulator.Install)

	c.JSON(http.StatusOK, response)
}

// GetDashboardAttentionDevices returns connectivity-problem devices across Android and Windows.
func (h *WindowsHandler) GetDashboardAttentionDevices(c *gin.Context) {
	user, userOK := middleware.CurrentUser(c)
	if !userOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	role, roleOK := middleware.CurrentRole(c)
	if !roleOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	limit := 5
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}

	includeAndroid := role.AllowsPlatform(models.PlatformScopeAndroid)
	includeWindows := role.AllowsPlatform(models.PlatformScopeWindows)

	customerID := user.CustomerID
	if customerID <= 0 {
		customerID = 1
	}
	now := time.Now().UTC()

	items := make([]models.DashboardAttentionDevice, 0, limit*2)
	response := models.DashboardAttentionDevicesResponse{
		Sources: models.DashboardSummarySources{
			Android: includeAndroid,
			Windows: includeWindows,
		},
	}

	if includeAndroid {
		androidItems, err := loadAndroidAttentionDevices(user, customerID, now, limit*4)
		if err != nil {
			log.Printf("[dashboard-attention] android query failed: user_id=%d err=%v", user.ID, err)
			response.Warnings = append(response.Warnings, "android attention data unavailable")
			response.Sources.Android = false
		} else {
			items = append(items, androidItems...)
		}
	}

	if includeWindows {
		windowsItems, err := loadWindowsAttentionDevices(now, limit*4)
		if err != nil {
			log.Printf("[dashboard-attention] windows query failed: err=%v", err)
			response.Warnings = append(response.Warnings, "windows attention data unavailable")
			response.Sources.Windows = false
		} else {
			items = append(items, windowsItems...)
		}
	}

	response.Items = rankDashboardAttentionDevices(items, limit)
	c.JSON(http.StatusOK, response)
}

func mergePartialDashboardSummary(target *partialDashboardSummary, part partialDashboardSummary) {
	target.Total += part.Total
	target.Enrolled += part.Enrolled
	target.EnrolledLastMonth += part.EnrolledLastMonth
	target.Status.Green += part.Status.Green
	target.Status.Yellow += part.Status.Yellow
	target.Status.Red += part.Status.Red
	target.Status.Grey += part.Status.Grey
	target.Status.Brown += part.Status.Brown
	target.Install.Success += part.Install.Success
	target.Install.VersionMismatch += part.Install.VersionMismatch
	target.Install.Failure += part.Install.Failure
}

func buildStatusChartItems(counts dashboardStatusCounts) []models.ChartItem {
	return []models.ChartItem{
		{StringAttr: "green", Number: counts.Green},
		{StringAttr: "yellow", Number: counts.Yellow},
		{StringAttr: "red", Number: counts.Red},
		{StringAttr: "grey", Number: counts.Grey},
		{StringAttr: "brown", Number: counts.Brown},
	}
}

func buildInstallChartItems(counts dashboardInstallCounts) []models.ChartItem {
	return []models.ChartItem{
		{StringAttr: "SUCCESS", Number: counts.Success},
		{StringAttr: "VERSION_MISMATCH", Number: counts.VersionMismatch},
		{StringAttr: "FAILURE", Number: counts.Failure},
	}
}

func loadAndroidDashboardSummary(user models.User, customerID int, now time.Time) (partialDashboardSummary, error) {
	part := partialDashboardSummary{}

	countSQL, countArgs := androidDeviceFilterSQL(user, customerID, "", true)
	if err := db.DB.Raw(countSQL, countArgs...).Scan(&part.Total).Error; err != nil {
		return part, err
	}

	enrolledSQL, enrolledArgs := androidDeviceFilterSQL(user, customerID, "", true)
	enrolledSQL += " AND d.enrolltime IS NOT NULL AND d.enrolltime > 0"
	if err := db.DB.Raw(enrolledSQL, enrolledArgs...).Scan(&part.Enrolled).Error; err != nil {
		return part, err
	}

	monthAgoMs := now.Add(-30 * 24 * time.Hour).UnixMilli()
	monthSQL, monthArgs := androidDeviceFilterSQL(user, customerID, "", true)
	monthSQL += " AND d.enrolltime IS NOT NULL AND d.enrolltime >= ?"
	monthArgs = append(monthArgs, monthAgoMs)
	if err := db.DB.Raw(monthSQL, monthArgs...).Scan(&part.EnrolledLastMonth).Error; err != nil {
		return part, err
	}

	statusSQL, statusArgs := androidDeviceFilterSQL(user, customerID, "", false)
	statusSQL = strings.Replace(statusSQL, `SELECT d.id, d.number, d.description, d.lastupdate, d.configurationid,
		c.name AS configname, c.qrcodekey AS configqrcodekey, d.info, d.infojson, d.imei, d.phone, d.enrolltime, d.publicip,
		d.custom1, d.custom2, d.custom3, d.oldnumber,
		applications.pkg AS launcherpkg, applicationversions.version AS launcherversion,
		groups.id AS groupid, groups.name AS groupname`, "SELECT DISTINCT d.id, d.lastupdate", 1)

	type statusRow struct {
		ID         uint   `gorm:"column:id"`
		LastUpdate *int64 `gorm:"column:lastupdate"`
	}
	var rows []statusRow
	if err := db.DB.Raw(statusSQL, statusArgs...).Scan(&rows).Error; err != nil {
		return part, err
	}
	for _, row := range rows {
		incrementStatusBucket(&part.Status, androidConnectivityBucket(row.LastUpdate, now))
	}

	installSQL := `
		SELECT COALESCE(ds.applicationsstatus, 'FAILURE') AS status, COUNT(DISTINCT d.id) AS count
		FROM devices d
		INNER JOIN users u ON u.id = ?
		LEFT JOIN devicestatuses ds ON d.id = ds.deviceid
		LEFT JOIN devicegroups ON d.id = devicegroups.deviceid
		LEFT JOIN groups ON devicegroups.groupid = groups.id
		LEFT JOIN userdevicegroupsaccess access ON groups.id = access.groupid AND access.userid = u.id
		WHERE d.customerid = ?
		AND d.configurationid IS NOT NULL
		AND (u.alldevicesavailable = TRUE OR access.id IS NOT NULL)
		GROUP BY COALESCE(ds.applicationsstatus, 'FAILURE')`
	var installRows []struct {
		Status string `gorm:"column:status"`
		Count  int64  `gorm:"column:count"`
	}
	if err := db.DB.Raw(installSQL, user.ID, customerID).Scan(&installRows).Error; err != nil {
		return part, err
	}
	for _, row := range installRows {
		switch strings.ToUpper(strings.TrimSpace(row.Status)) {
		case "SUCCESS":
			part.Install.Success += row.Count
		case "VERSION_MISMATCH":
			part.Install.VersionMismatch += row.Count
		default:
			part.Install.Failure += row.Count
		}
	}

	return part, nil
}

func loadWindowsDashboardSummary(now time.Time) (partialDashboardSummary, error) {
	part := partialDashboardSummary{}

	var devices []models.WindowsDevice
	if err := db.DB.Find(&devices).Error; err != nil {
		return part, err
	}

	part.Total = int64(len(devices))
	monthAgo := now.Add(-30 * 24 * time.Hour)

	for _, device := range devices {
		incrementStatusBucket(&part.Status, windowsConnectivityBucket(device, now))
		if device.AgentStatus != models.AgentStatusUninstalled {
			part.Enrolled++
			if !device.LastCheckin.IsZero() && !device.LastCheckin.Before(monthAgo) {
				part.EnrolledLastMonth++
			}
		}
	}

	if err := db.DB.Model(&models.DeviceAppStatus{}).
		Where("status = ?", models.AppStatusFailed).
		Distinct("device_id").
		Count(&part.Install.Failure).Error; err != nil {
		return part, err
	}
	if err := db.DB.Model(&models.DeviceAppStatus{}).
		Where("status = ?", models.AppStatusSuccess).
		Distinct("device_id").
		Count(&part.Install.Success).Error; err != nil {
		return part, err
	}

	return part, nil
}

func androidConnectivityBucket(lastUpdate *int64, now time.Time) string {
	if lastUpdate == nil || *lastUpdate <= 0 {
		return "grey"
	}
	ageMs := now.UnixMilli() - *lastUpdate
	switch {
	case ageMs < dashboardOnlineGreenMs:
		return "green"
	case ageMs < dashboardOnlineYellowMs:
		return "yellow"
	default:
		return "red"
	}
}

func windowsConnectivityBucket(device models.WindowsDevice, now time.Time) string {
	if device.AgentStatus == models.AgentStatusUninstalled {
		return "brown"
	}
	if device.LastCheckin.IsZero() {
		return "grey"
	}
	ageMs := now.UnixMilli() - device.LastCheckin.UTC().UnixMilli()
	switch {
	case ageMs < dashboardOnlineGreenMs:
		return "green"
	case ageMs < dashboardOnlineYellowMs:
		return "yellow"
	default:
		return "red"
	}
}

func incrementStatusBucket(counts *dashboardStatusCounts, bucket string) {
	switch bucket {
	case "green":
		counts.Green++
	case "yellow":
		counts.Yellow++
	case "red":
		counts.Red++
	case "brown":
		counts.Brown++
	default:
		counts.Grey++
	}
}

func loadAndroidAttentionDevices(user models.User, customerID int, now time.Time, limit int) ([]models.DashboardAttentionDevice, error) {
	listSQL, listArgs := androidDeviceFilterSQL(user, customerID, "", false)
	listSQL += " ORDER BY d.lastupdate ASC NULLS FIRST LIMIT ?"
	listArgs = append(listArgs, limit)

	var rows []androidDeviceSearchRow
	if err := db.DB.Raw(listSQL, listArgs...).Scan(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]models.DashboardAttentionDevice, 0)
	seen := make(map[uint]struct{})
	for _, row := range rows {
		if _, ok := seen[row.ID]; ok {
			continue
		}
		seen[row.ID] = struct{}{}
		status := androidConnectivityBucket(row.LastUpdate, now)
		if status == "green" {
			continue
		}
		displayName := strings.TrimSpace(derefString(row.Description))
		if displayName == "" {
			displayName = row.Number
		}
		items = append(items, models.DashboardAttentionDevice{
			Platform:          "android",
			Number:            row.Number,
			DisplayName:       displayName,
			StatusCode:        status,
			LastUpdate:        row.LastUpdate,
			ConfigurationName: derefString(row.ConfigName),
		})
	}
	return items, nil
}

func loadWindowsAttentionDevices(now time.Time, limit int) ([]models.DashboardAttentionDevice, error) {
	var devices []models.WindowsDevice
	if err := db.DB.Order("last_checkin ASC NULLS FIRST").Limit(limit).Find(&devices).Error; err != nil {
		return nil, err
	}

	items := make([]models.DashboardAttentionDevice, 0, len(devices))
	for _, device := range devices {
		status := windowsConnectivityBucket(device, now)
		if status == "green" {
			continue
		}
		displayName := strings.TrimSpace(device.Hostname)
		if displayName == "" {
			displayName = strings.TrimSpace(device.Model)
		}
		if displayName == "" {
			displayName = device.HardwareID
		}
		lastUpdate := device.LastCheckin.UTC().UnixMilli()
		items = append(items, models.DashboardAttentionDevice{
			Platform:    "windows",
			Number:      device.HardwareID,
			DisplayName: displayName,
			StatusCode:  status,
			LastUpdate:  &lastUpdate,
		})
	}
	return items, nil
}

func rankDashboardAttentionDevices(items []models.DashboardAttentionDevice, limit int) []models.DashboardAttentionDevice {
	if len(items) == 0 {
		return items
	}
	rank := map[string]int{
		"brown":  100,
		"red":    90,
		"grey":   70,
		"yellow": 50,
		"green":  0,
	}
	sorted := make([]models.DashboardAttentionDevice, len(items))
	copy(sorted, items)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if rank[sorted[j].StatusCode] > rank[sorted[i].StatusCode] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	if len(sorted) > limit {
		sorted = sorted[:limit]
	}
	return sorted
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
