//go:build windows

package apps

import (
	"regexp"
	"strconv"
	"strings"
)

var versionNumberPattern = regexp.MustCompile(`\d+`)

// CompareVersions compares two software version strings.
// Returns <0 if a < b, 0 if equal, >0 if a > b.
// Prefers numeric segment comparison (SemVer-compatible, also handles 1.2.3.4).
// Falls back to case-insensitive string equality / ordering when neither side has digits.
func CompareVersions(a, b string) int {
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
