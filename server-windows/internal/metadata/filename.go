package metadata

import (
	"path/filepath"
	"regexp"
	"strings"
)

var filenameVersionPattern = regexp.MustCompile(`(?i)v?([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:\.[0-9]+)?)`)

var filenameNoiseWords = map[string]struct{}{
	"windows":   {},
	"win":       {},
	"x64":       {},
	"x86":       {},
	"amd64":     {},
	"installer": {},
	"setup":     {},
	"portable":  {},
}

// ParseFilenameMetadata derives display name and version from an upload filename.
func ParseFilenameMetadata(originalFilename string) InstallerMetadata {
	base := strings.TrimSpace(originalFilename)
	base = filepath.Base(base)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	if base == "" {
		return InstallerMetadata{}
	}

	match := filenameVersionPattern.FindStringSubmatchIndex(base)
	namePart := base
	version := ""
	if match != nil && len(match) >= 4 {
		version = base[match[2]:match[3]]
		namePart = strings.TrimSpace(base[:match[0]])
	}

	name := cleanFilenameName(namePart)
	if name == "" && version == "" {
		name = cleanFilenameName(base)
	}

	return InstallerMetadata{
		Name:    name,
		Version: version,
	}
}

func cleanFilenameName(raw string) string {
	s := strings.ReplaceAll(strings.TrimSpace(raw), "-", " ")
	s = strings.ReplaceAll(s, "_", " ")

	words := strings.Fields(s)
	if len(words) == 0 {
		return ""
	}

	filtered := make([]string, 0, len(words))
	for _, word := range words {
		if _, skip := filenameNoiseWords[strings.ToLower(word)]; skip {
			continue
		}
		filtered = append(filtered, word)
	}

	return strings.Join(filtered, " ")
}
