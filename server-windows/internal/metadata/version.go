package metadata

import (
	"regexp"
	"strings"
)

const DefaultInstallerVersion = "1.0.0"

var (
	versionTokenPattern = regexp.MustCompile(`(?i)^v?([0-9]+(?:\.[0-9]+){0,3}(?:[-+][0-9A-Za-z.-]+)?)$`)
	looseVersionPattern = regexp.MustCompile(`([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)`)
)

// NormalizeVersion cleans installer version strings from PE/MSI metadata.
func NormalizeVersion(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}

	value = strings.ReplaceAll(value, ",", ".")
	value = strings.Trim(value, "\x00")
	value = strings.TrimSpace(value)

	if match := versionTokenPattern.FindStringSubmatch(value); len(match) == 2 {
		return match[1]
	}

	if match := looseVersionPattern.FindStringSubmatch(value); len(match) == 2 {
		return match[1]
	}

	return value
}

func resolveVersion(fileVersion, filename, originalFilename string) string {
	for _, candidate := range []string{fileVersion, filename} {
		if normalized := NormalizeVersion(candidate); normalized != "" {
			return normalized
		}
	}
	if normalized := NormalizeVersion(ParseFilenameMetadata(originalFilename).Version); normalized != "" {
		return normalized
	}
	return ""
}

func resolveName(fileName, filename, originalFilename string) string {
	for _, candidate := range []string{fileName, filename} {
		if trimmed := strings.TrimSpace(candidate); trimmed != "" {
			return trimmed
		}
	}
	if name := strings.TrimSpace(ParseFilenameMetadata(originalFilename).Name); name != "" {
		return name
	}
	return FallbackName(originalFilename)
}

func resolvePublisher(values ...string) string {
	return firstNonEmpty(values...)
}
