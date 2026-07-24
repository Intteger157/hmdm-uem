package metadata

import (
	"bytes"
	"encoding/binary"
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
	needle := utf16.Encode([]rune(property))
	for i := 0; i+len(needle)*2 <= len(data); i++ {
		if !bytes.Equal(data[i:i+len(needle)*2], utf16LEBytes(needle)) {
			continue
		}
		if value := readNearbyVersion(data[i:]); value != "" {
			return value
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

	var runes []uint16
	for i := start; i+1 < len(data); i += 2 {
		value := binary.LittleEndian.Uint16(data[i : i+2])
		if value == 0 {
			if len(runes) == 0 {
				continue
			}
			return strings.TrimSpace(string(utf16.Decode(runes)))
		}
		if value < 32 && value != 9 {
			if len(runes) > 0 {
				break
			}
			continue
		}
		runes = append(runes, value)
	}
	if len(runes) == 0 {
		return ""
	}
	return strings.TrimSpace(string(utf16.Decode(runes)))
}

func utf16LEBytes(values []uint16) []byte {
	out := make([]byte, len(values)*2)
	for i, value := range values {
		binary.LittleEndian.PutUint16(out[i*2:], value)
	}
	return out
}
