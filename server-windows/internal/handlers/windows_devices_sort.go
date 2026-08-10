package handlers

import (
	"fmt"
	"strings"
)

func windowsDeviceSortExpr(sortBy, sortDir string) string {
	dir := "ASC"
	if strings.EqualFold(strings.TrimSpace(sortDir), "DESC") {
		dir = "DESC"
	}

	column := "LOWER(COALESCE(NULLIF(hostname, ''), hardware_id))"
	switch strings.ToUpper(strings.TrimSpace(sortBy)) {
	case "LAST_UPDATE":
		column = "last_checkin"
	case "DESCRIPTION":
		column = "LOWER(COALESCE(NULLIF(model, ''), NULLIF(manufacturer, ''), description, ''))"
	case "CURRENT_USER":
		column = "LOWER(COALESCE(current_user, ''))"
	case "NUMBER":
		column = "LOWER(hardware_id)"
	case "HOSTNAME":
		column = "LOWER(COALESCE(NULLIF(hostname, ''), hardware_id))"
	}

	// Tie-breaker keeps row order stable when the primary sort key matches.
	return fmt.Sprintf("%s %s NULLS LAST, LOWER(hardware_id) ASC", column, dir)
}
