package metadata

import (
	"bytes"
	"strings"
	"unicode/utf16"
)

func scanMetadataFromBinary(data []byte) InstallerMetadata {
	return InstallerMetadata{
		Name:      scanStringProperty(data, "ProductName"),
		Version:   NormalizeVersion(scanVersionProperty(data, "ProductVersion")),
		Publisher: firstNonEmpty(
			scanStringProperty(data, "CompanyName"),
			scanStringProperty(data, "Manufacturer"),
		),
	}
}

func scanVersionProperty(data []byte, property string) string {
	if value := scanUTF16VersionProperty(data, property); value != "" {
		return value
	}
	return scanASCIIVersionProperty(data, property)
}

func scanUTF16VersionProperty(data []byte, property string) string {
	needle := utf16LEBytes(utf16.Encode([]rune(property)))
	for i := 0; i+len(needle) <= len(data); i++ {
		if !bytes.Equal(data[i:i+len(needle)], needle) {
			continue
		}
		if value := readUTF16ValueAfterKey(data[i:], len(needle)); value != "" {
			if normalized := NormalizeVersion(value); normalized != "" && !strings.EqualFold(normalized, property) {
				return normalized
			}
		}
	}
	return ""
}

func scanASCIIVersionProperty(data []byte, property string) string {
	needle := []byte(property)
	index := bytes.Index(data, needle)
	if index < 0 {
		return ""
	}
	return readNearbyVersion(data[index:])
}

func readNearbyVersion(chunk []byte) string {
	if len(chunk) > 4096 {
		chunk = chunk[:4096]
	}

	if utf16Value := firstUTF16StringAfter(chunk, 64); utf16Value != "" {
		if normalized := NormalizeVersion(utf16Value); normalized != "" && !strings.EqualFold(normalized, "ProductVersion") {
			return normalized
		}
	}

	if asciiValue := looseVersionPattern.FindString(string(chunk)); asciiValue != "" {
		return NormalizeVersion(asciiValue)
	}
	return ""
}

func firstUTF16StringAfter(data []byte, skipBytes int) string {
	start := skipBytes
	if start >= len(data) {
		return ""
	}
	if start%2 == 1 {
		start++
	}
	return readUTF16StringAt(data, start)
}
