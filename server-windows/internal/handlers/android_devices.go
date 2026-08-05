package handlers

import (
	"fmt"
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

type androidDeviceSearchRequest struct {
	Value    string `json:"value"`
	PageNum  int    `json:"pageNum"`
	PageSize int    `json:"pageSize"`
	SortBy   string `json:"sortBy"`
	SortDir  string `json:"sortDir"`
}

type androidLookupItem struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type androidDeviceInfoView struct {
	Model           string `json:"model,omitempty"`
	IMEI            string `json:"imei,omitempty"`
	Phone           string `json:"phone,omitempty"`
	AndroidVersion  string `json:"androidVersion,omitempty"`
	Serial          string `json:"serial,omitempty"`
	MDMMode         *bool  `json:"mdmMode,omitempty"`
	KioskMode       *bool  `json:"kioskMode,omitempty"`
	BatteryLevel    *int   `json:"batteryLevel,omitempty"`
	DefaultLauncher *bool  `json:"defaultLauncher,omitempty"`
}

type androidDeviceView struct {
	ID                uint                  `json:"id"`
	Platform          string                `json:"platform"`
	ConfigurationID   uint                  `json:"configurationId"`
	ConfigurationName string                `json:"configurationName,omitempty"`
	Number            string                `json:"number"`
	Description       string                `json:"description,omitempty"`
	LastUpdate        *int64                `json:"lastUpdate,omitempty"`
	IMEI              string                `json:"imei,omitempty"`
	Phone             string                `json:"phone,omitempty"`
	PublicIP          string                `json:"publicIp,omitempty"`
	Custom1           string                `json:"custom1,omitempty"`
	Custom2           string                `json:"custom2,omitempty"`
	Custom3           string                `json:"custom3,omitempty"`
	EnrollTime        *int64                `json:"enrollTime,omitempty"`
	MDMMode           *bool                 `json:"mdmMode,omitempty"`
	KioskMode         *bool                 `json:"kioskMode,omitempty"`
	AndroidVersion    string                `json:"androidVersion,omitempty"`
	Serial            string                `json:"serial,omitempty"`
	LauncherVersion   string                `json:"launcherVersion,omitempty"`
	LauncherPkg       string                `json:"launcherPkg,omitempty"`
	StatusCode        string                `json:"statusCode,omitempty"`
	OldNumber         string                `json:"oldNumber,omitempty"`
	Groups            []androidLookupItem   `json:"groups,omitempty"`
	Info              *androidDeviceInfoView `json:"info,omitempty"`
}

type androidConfigurationView struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type androidDeviceListResponse struct {
	Configurations map[string]androidConfigurationView `json:"configurations"`
	Devices        struct {
		Items           []androidDeviceView `json:"items"`
		TotalItemsCount int64               `json:"totalItemsCount"`
	} `json:"devices"`
}

type androidDeviceSearchRow struct {
	ID                uint    `gorm:"column:id"`
	Number            string  `gorm:"column:number"`
	Description       *string `gorm:"column:description"`
	LastUpdate        *int64  `gorm:"column:lastupdate"`
	ConfigurationID   *uint   `gorm:"column:configurationid"`
	ConfigName        *string `gorm:"column:configname"`
	Info              *string `gorm:"column:info"`
	InfoJSON          []byte  `gorm:"column:infojson"`
	IMEI              *string `gorm:"column:imei"`
	Phone             *string `gorm:"column:phone"`
	EnrollTime        *int64  `gorm:"column:enrolltime"`
	PublicIP          *string `gorm:"column:publicip"`
	Custom1           *string `gorm:"column:custom1"`
	Custom2           *string `gorm:"column:custom2"`
	Custom3           *string `gorm:"column:custom3"`
	OldNumber         *string `gorm:"column:oldnumber"`
	LauncherPkg       *string `gorm:"column:launcherpkg"`
	LauncherVersion   *string `gorm:"column:launcherversion"`
	GroupID           *uint   `gorm:"column:groupid"`
	GroupName         *string `gorm:"column:groupname"`
}

// SearchAndroidDevices lists enrolled Android agents for the console Devices page.
func (h *WindowsHandler) SearchAndroidDevices(c *gin.Context) {
	var req androidDeviceSearchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pageNum := req.PageNum
	if pageNum < 1 {
		pageNum = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 50
	}
	if pageSize > 200 {
		pageSize = 200
	}

	user, userOK := middleware.CurrentUser(c)
	if !userOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	customerID := user.CustomerID
	if customerID <= 0 {
		customerID = 1
	}

	search := strings.TrimSpace(req.Value)
	sortExpr := androidDeviceSortExpr(req.SortBy, req.SortDir)

	countSQL, countArgs := androidDeviceFilterSQL(user, customerID, search, true)
	var total int64
	if err := db.DB.Raw(countSQL, countArgs...).Scan(&total).Error; err != nil {
		log.Printf("[android-devices] count failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to count devices"})
		return
	}

	listSQL, listArgs := androidDeviceFilterSQL(user, customerID, search, false)
	listSQL += fmt.Sprintf(" ORDER BY %s OFFSET %d LIMIT %d", sortExpr, (pageNum-1)*pageSize, pageSize)

	var rows []androidDeviceSearchRow
	if err := db.DB.Raw(listSQL, listArgs...).Scan(&rows).Error; err != nil {
		log.Printf("[android-devices] query failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list devices"})
		return
	}

	response := buildAndroidDeviceListResponse(rows)
	response.Devices.TotalItemsCount = total
	c.JSON(http.StatusOK, response)
}

// GetAndroidDeviceByNumber returns one Android device for the detail page.
func (h *WindowsHandler) GetAndroidDeviceByNumber(c *gin.Context) {
	number := strings.TrimSpace(c.Param("number"))
	if number == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing device number"})
		return
	}

	user, userOK := middleware.CurrentUser(c)
	if !userOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	customerID := user.CustomerID
	if customerID <= 0 {
		customerID = 1
	}

	listSQL, listArgs := androidDeviceFilterSQL(user, customerID, number, false)
	listSQL += " AND LOWER(d.number) = LOWER(?) ORDER BY d.lastupdate DESC NULLS LAST LIMIT 20"
	listArgs = append(listArgs, number)

	var rows []androidDeviceSearchRow
	if err := db.DB.Raw(listSQL, listArgs...).Scan(&rows).Error; err != nil {
		log.Printf("[android-devices] lookup number=%q failed: %v", number, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup device"})
		return
	}
	if len(rows) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		return
	}

	response := buildAndroidDeviceListResponse(rows)
	c.JSON(http.StatusOK, response.Devices.Items[0])
}

func androidDeviceSortExpr(sortBy, sortDir string) string {
	dir := "DESC"
	if strings.EqualFold(strings.TrimSpace(sortDir), "ASC") {
		dir = "ASC"
	}

	column := "d.lastupdate"
	switch strings.ToUpper(strings.TrimSpace(sortBy)) {
	case "NUMBER":
		column = "LOWER(d.number)"
	case "IMEI":
		column = "LOWER(COALESCE(d.imei, ''))"
	case "PHONE":
		column = "LOWER(COALESCE(d.phone, ''))"
	case "DESCRIPTION":
		column = "LOWER(COALESCE(d.description, ''))"
	case "CONFIGURATION":
		column = "LOWER(COALESCE(c.name, ''))"
	case "ENROLLMENT_DATE":
		column = "d.enrolltime"
	case "ANDROID_VERSION":
		column = "LOWER(COALESCE(d.infojson ->> 'androidVersion', ''))"
	case "SERIAL":
		column = "LOWER(COALESCE(d.infojson ->> 'serial', d.infojson ->> 'serialNumber', ''))"
	}

	return fmt.Sprintf("%s %s NULLS LAST, LOWER(d.number) ASC", column, dir)
}

func androidDeviceFilterSQL(user models.User, customerID int, search string, countOnly bool) (string, []any) {
	selectClause := `SELECT d.id, d.number, d.description, d.lastupdate, d.configurationid,
		c.name AS configname, d.info, d.infojson, d.imei, d.phone, d.enrolltime, d.publicip,
		d.custom1, d.custom2, d.custom3, d.oldnumber,
		applications.pkg AS launcherpkg, applicationversions.version AS launcherversion,
		groups.id AS groupid, groups.name AS groupname`
	if countOnly {
		selectClause = "SELECT COUNT(DISTINCT d.id)"
	}

	sql := selectClause + `
		FROM devices d
		INNER JOIN users u ON u.id = ?
		LEFT JOIN configurations c ON d.configurationid = c.id
		LEFT JOIN applicationversions ON c.mainappid = applicationversions.id
		LEFT JOIN applications ON applications.id = applicationversions.applicationid
		LEFT JOIN devicegroups ON d.id = devicegroups.deviceid
		LEFT JOIN groups ON devicegroups.groupid = groups.id
		LEFT JOIN userdevicegroupsaccess access ON groups.id = access.groupid AND access.userid = u.id
		WHERE d.customerid = ?
		AND d.configurationid IS NOT NULL
		AND (u.alldevicesavailable = TRUE OR access.id IS NOT NULL)`

	args := []any{user.ID, customerID}

	if search != "" {
		like := "%" + search + "%"
		sql += `
		AND (
			d.number ILIKE ? OR d.description ILIKE ? OR d.imei ILIKE ? OR d.phone ILIKE ?
			OR d.publicip ILIKE ? OR d.custom1 ILIKE ? OR d.custom2 ILIKE ? OR d.custom3 ILIKE ?
			OR d.oldnumber ILIKE ? OR c.name ILIKE ? OR groups.name ILIKE ?
			OR d.infojson ->> 'imei' ILIKE ? OR d.infojson ->> 'phone' ILIKE ?
			OR d.infojson ->> 'model' ILIKE ? OR d.infojson ->> 'serial' ILIKE ?
		)`
		args = append(args, like, like, like, like, like, like, like, like, like, like, like, like, like, like, like)
	}

	return sql, args
}

func buildAndroidDeviceListResponse(rows []androidDeviceSearchRow) androidDeviceListResponse {
	now := time.Now().UTC()
	byID := make(map[uint]*androidDeviceView, len(rows))
	configurations := make(map[string]androidConfigurationView)
	order := make([]uint, 0, len(rows))

	for _, row := range rows {
		if row.ConfigurationID == nil {
			continue
		}

		configID := *row.ConfigurationID
		configKey := strconv.FormatUint(uint64(configID), 10)
		if _, ok := configurations[configKey]; !ok {
			name := ""
			if row.ConfigName != nil {
				name = strings.TrimSpace(*row.ConfigName)
			}
			configurations[configKey] = androidConfigurationView{
				ID:   configID,
				Name: name,
			}
		}

		device, ok := byID[row.ID]
		if !ok {
			infoParsed := models.ParseAndroidDeviceInfo(row.InfoJSON, row.Info)
			device = &androidDeviceView{
				ID:              row.ID,
				Platform:        "android",
				ConfigurationID: configID,
				Number:          row.Number,
				LastUpdate:      row.LastUpdate,
				EnrollTime:      row.EnrollTime,
				StatusCode:      models.AndroidOnlineStatus(row.LastUpdate, now),
				MDMMode:         infoParsed.MDMMode,
				KioskMode:       infoParsed.KioskMode,
				Info: &androidDeviceInfoView{
					Model:           infoParsed.Model,
					IMEI:            infoParsed.IMEI,
					Phone:           infoParsed.Phone,
					AndroidVersion:  infoParsed.AndroidVersion,
					Serial:          infoParsed.Serial,
					MDMMode:         infoParsed.MDMMode,
					KioskMode:       infoParsed.KioskMode,
					BatteryLevel:    infoParsed.BatteryLevel,
					DefaultLauncher: infoParsed.DefaultLauncher,
				},
			}
			if row.ConfigName != nil {
				device.ConfigurationName = strings.TrimSpace(*row.ConfigName)
			}
			if row.Description != nil {
				device.Description = strings.TrimSpace(*row.Description)
			}
			if row.IMEI != nil && strings.TrimSpace(*row.IMEI) != "" {
				device.IMEI = strings.TrimSpace(*row.IMEI)
			} else if infoParsed.IMEI != "" {
				device.IMEI = infoParsed.IMEI
			}
			if row.Phone != nil && strings.TrimSpace(*row.Phone) != "" {
				device.Phone = strings.TrimSpace(*row.Phone)
			} else if infoParsed.Phone != "" {
				device.Phone = infoParsed.Phone
			}
			if row.PublicIP != nil {
				device.PublicIP = strings.TrimSpace(*row.PublicIP)
			}
			if row.Custom1 != nil {
				device.Custom1 = strings.TrimSpace(*row.Custom1)
			}
			if row.Custom2 != nil {
				device.Custom2 = strings.TrimSpace(*row.Custom2)
			}
			if row.Custom3 != nil {
				device.Custom3 = strings.TrimSpace(*row.Custom3)
			}
			if row.OldNumber != nil {
				device.OldNumber = strings.TrimSpace(*row.OldNumber)
			}
			if row.LauncherPkg != nil {
				device.LauncherPkg = strings.TrimSpace(*row.LauncherPkg)
			}
			if row.LauncherVersion != nil {
				device.LauncherVersion = strings.TrimSpace(*row.LauncherVersion)
			}
			if infoParsed.AndroidVersion != "" {
				device.AndroidVersion = infoParsed.AndroidVersion
			}
			if infoParsed.Serial != "" {
				device.Serial = infoParsed.Serial
			}
			byID[row.ID] = device
			order = append(order, row.ID)
		}

		if row.GroupID != nil && row.GroupName != nil {
			groupID := *row.GroupID
			groupName := strings.TrimSpace(*row.GroupName)
			already := false
			for _, group := range device.Groups {
				if group.ID == groupID {
					already = true
					break
				}
			}
			if !already && groupName != "" {
				device.Groups = append(device.Groups, androidLookupItem{
					ID:   groupID,
					Name: groupName,
				})
			}
		}
	}

	response := androidDeviceListResponse{
		Configurations: configurations,
	}
	response.Devices.Items = make([]androidDeviceView, 0, len(order))
	for _, id := range order {
		if device := byID[id]; device != nil {
			if len(device.Groups) == 0 {
				device.Groups = nil
			}
			response.Devices.Items = append(response.Devices.Items, *device)
		}
	}

	if len(response.Configurations) == 0 {
		response.Configurations = map[string]androidConfigurationView{}
	}

	return response
}
