package handlers

import (
	"strings"

	"gorm.io/gorm"
)

// windowsDeviceSearchColumns lists ILIKE targets for ListDevices search.
// UI "description" for Windows is manufacturer/model — there is no description column.
// "current_user" must be quoted: bare current_user is the PostgreSQL session-user function.
const windowsDeviceSearchColumns = `hardware_id ILIKE ? OR hostname ILIKE ? OR os_version ILIKE ? OR cpu ILIKE ?
OR "current_user" ILIKE ? OR manufacturer ILIKE ? OR model ILIKE ? OR serial_number ILIKE ?`

// applyWindowsDeviceSearch filters devices when value is non-empty (case-insensitive partial match).
func applyWindowsDeviceSearch(query *gorm.DB, searchValue string) *gorm.DB {
	searchValue = strings.TrimSpace(searchValue)
	if searchValue == "" {
		return query
	}

	like := "%" + searchValue + "%"
	return query.Where(
		windowsDeviceSearchColumns,
		like, like, like, like, like, like, like, like,
	)
}

func windowsDeviceSearchArgCount() int {
	return strings.Count(windowsDeviceSearchColumns, "ILIKE ?")
}
