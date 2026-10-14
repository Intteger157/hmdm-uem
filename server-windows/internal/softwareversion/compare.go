package softwareversion

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/hmdm/server-windows/internal/models"
)

var versionNumberPattern = regexp.MustCompile(`\d+`)

// Compare compares two software version strings.
// Returns <0 if a < b, 0 if equal, >0 if a > b.
func Compare(a, b string) int {
	left := strings.TrimSpace(a)
	right := strings.TrimSpace(b)
	if left == "" && right == "" {
		return 0
	}
	if left == "" {
		return -1
	}
	if right == "" {
		return 1
	}
	if strings.EqualFold(left, right) {
		return 0
	}

	leftParts := parseVersionParts(left)
	rightParts := parseVersionParts(right)
	if len(leftParts) == 0 && len(rightParts) == 0 {
		return strings.Compare(strings.ToLower(left), strings.ToLower(right))
	}

	maxLen := len(leftParts)
	if len(rightParts) > maxLen {
		maxLen = len(rightParts)
	}
	for i := 0; i < maxLen; i++ {
		var lv, rv int
		if i < len(leftParts) {
			lv = leftParts[i]
		}
		if i < len(rightParts) {
			rv = rightParts[i]
		}
		if lv < rv {
			return -1
		}
		if lv > rv {
			return 1
		}
	}
	return 0
}

func parseVersionParts(raw string) []int {
	matches := versionNumberPattern.FindAllString(raw, -1)
	if len(matches) == 0 {
		return nil
	}
	parts := make([]int, 0, len(matches))
	for _, match := range matches {
		n, err := strconv.Atoi(match)
		if err != nil {
			continue
		}
		parts = append(parts, n)
	}
	return parts
}

// DriftDirection classifies installed vs expected catalog version.
type DriftDirection string

const (
	DriftLower  DriftDirection = "lower"
	DriftHigher DriftDirection = "higher"
)

// MatchInstalled finds the best inventory row for a managed app name.
func MatchInstalled(appName string, installed []models.InstalledSoftwareRecord) *models.InstalledSoftwareRecord {
	targetName := strings.ToLower(strings.TrimSpace(appName))
	if targetName == "" {
		return nil
	}

	var bestMatch *models.InstalledSoftwareRecord
	exactName := false

	for i := range installed {
		item := &installed[i]
		itemName := strings.ToLower(strings.TrimSpace(item.Name))
		if itemName == "" {
			continue
		}

		isExact := itemName == targetName
		isPartial := strings.Contains(itemName, targetName)
		if !isExact && !isPartial {
			continue
		}

		if bestMatch == nil {
			bestMatch = item
			exactName = isExact
			continue
		}
		if isExact && !exactName {
			bestMatch = item
			exactName = true
			continue
		}
		if isExact == exactName && Compare(item.Version, bestMatch.Version) > 0 {
			bestMatch = item
		}
	}
	return bestMatch
}

// EvaluateDrift compares inventory against the policy version. ok=true when versions match.
func EvaluateDrift(appName, expectedVersion string, installed []models.InstalledSoftwareRecord) (installedVersion string, direction DriftDirection, ok bool) {
	expected := strings.TrimSpace(expectedVersion)
	if expected == "" {
		return "", "", true
	}

	match := MatchInstalled(appName, installed)
	if match == nil {
		return "", DriftLower, false
	}

	installedVersion = strings.TrimSpace(match.Version)
	cmp := Compare(installedVersion, expected)
	switch {
	case cmp == 0:
		return installedVersion, "", true
	case cmp < 0:
		return installedVersion, DriftLower, false
	default:
		return installedVersion, DriftHigher, false
	}
}
