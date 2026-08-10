package models

import (
	"regexp"
	"strings"
)

// SanitizeSerialNumber returns a cleaned serial or empty string for placeholders/labels.
func SanitizeSerialNumber(raw string) string {
	serial := strings.TrimSpace(raw)
	if serial == "" {
		return ""
	}
	lower := strings.ToLower(serial)
	switch lower {
	case "to be filled by o.e.m.", "default string", "system serial number", "none", "0", "0123456789", "123456789",
		"chassis serial number", "base board serial number", "product serial", "asset tag",
		"not specified", "not applicable", "not available", "n/a", "na", "unknown", "invalid", "oem":
		return ""
	}
	if looksLikeSerialLabel(serial) {
		return ""
	}
	return serial
}

var serialDigitPattern = regexp.MustCompile(`\d`)

func looksLikeSerialLabel(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return true
	}
	lower := strings.ToLower(trimmed)
	if !strings.Contains(lower, "serial") {
		return false
	}
	return !serialDigitPattern.MatchString(trimmed)
}
