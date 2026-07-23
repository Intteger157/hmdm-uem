package metadata

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf16"

	"github.com/richardlehane/mscfb"
	"github.com/richardlehane/msoleps"
	"github.com/saferwall/pe"
)

// InstallerMetadata holds parsed installer properties.
type InstallerMetadata struct {
	Name    string
	Version string
}

// ParseInstallerMetadata extracts product name and version from .exe or .msi files.
func ParseInstallerMetadata(path string) (InstallerMetadata, error) {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".exe":
		return parseExeMetadata(path)
	case ".msi":
		return parseMsiMetadata(path)
	default:
		return InstallerMetadata{}, fmt.Errorf("unsupported file extension %q", ext)
	}
}

func parseExeMetadata(path string) (InstallerMetadata, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return InstallerMetadata{}, err
	}

	file, err := pe.NewBytes(data, &pe.Options{})
	if err != nil {
		return InstallerMetadata{}, err
	}

	resources, err := file.ParseVersionResources()
	if err != nil {
		return InstallerMetadata{}, err
	}

	return InstallerMetadata{
		Name:    firstNonEmpty(resources["ProductName"], resources["FileDescription"], resources["InternalName"]),
		Version: firstNonEmpty(resources["ProductVersion"], resources["FileVersion"]),
	}, nil
}

func parseMsiMetadata(path string) (InstallerMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return InstallerMetadata{}, err
	}
	defer file.Close()

	doc, err := mscfb.New(file)
	if err != nil {
		return InstallerMetadata{}, err
	}

	meta := InstallerMetadata{}
	for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
		switch entry.Name {
		case "Property":
			if propertyValues, err := readMsiProperties(entry); err == nil {
				if meta.Name == "" {
					meta.Name = propertyValues["ProductName"]
				}
				if meta.Version == "" {
					meta.Version = propertyValues["ProductVersion"]
				}
			}
		default:
			if !msoleps.IsMSOLEPS(entry.Initial) {
				continue
			}
			data, err := readEntryData(entry)
			if err != nil {
				continue
			}
			props, err := msoleps.NewFrom(bytes.NewReader(data))
			if err != nil {
				continue
			}
			for _, prop := range props.Property {
				value := strings.TrimSpace(prop.String())
				switch prop.Name {
				case "Title":
					if meta.Name == "" {
						meta.Name = value
					}
				case "Subject":
					if meta.Name == "" {
						meta.Name = value
					}
				}
			}
		}
	}

	return meta, nil
}

func readMsiProperties(entry *mscfb.File) (map[string]string, error) {
	data, err := readEntryData(entry)
	if err != nil {
		return nil, err
	}
	if len(data) < 2 {
		return nil, fmt.Errorf("property stream too short")
	}

	count := int(binary.LittleEndian.Uint16(data[0:2]))
	if count <= 0 || len(data) < 2+count*2 {
		return nil, fmt.Errorf("invalid property count")
	}

	nameIndexes := make([]int, count)
	for i := 0; i < count; i++ {
		offset := 2 + i*2
		nameIndexes[i] = int(binary.LittleEndian.Uint16(data[offset : offset+2]))
	}

	stringPoolOffset := 2 + count*2
	stringsList := parseMsiStringPool(data[stringPoolOffset:])
	if len(stringsList) == 0 {
		return nil, fmt.Errorf("empty string pool")
	}

	props := make(map[string]string, count)
	for _, nameIndex := range nameIndexes {
		valueIndex := nameIndex + 1
		if nameIndex < 0 || nameIndex >= len(stringsList) {
			continue
		}
		if valueIndex < 0 || valueIndex >= len(stringsList) {
			continue
		}
		name := stringsList[nameIndex]
		if name == "" {
			continue
		}
		props[name] = stringsList[valueIndex]
	}
	return props, nil
}

func readEntryData(entry *mscfb.File) ([]byte, error) {
	if _, err := entry.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return io.ReadAll(entry)
}

func parseMsiStringPool(data []byte) []string {
	if len(data) == 0 {
		return nil
	}

	result := make([]string, 0, 8)
	start := 0
	for i := 0; i < len(data); i++ {
		if data[i] != 0 {
			continue
		}
		if i > start {
			result = append(result, decodeMsiString(data[start:i]))
		}
		start = i + 1
	}
	if start < len(data) {
		result = append(result, decodeMsiString(data[start:]))
	}
	return result
}

func decodeMsiString(raw []byte) string {
	if len(raw) >= 2 && len(raw)%2 == 0 && looksLikeUTF16LE(raw) {
		u16 := make([]uint16, len(raw)/2)
		for i := range u16 {
			u16[i] = binary.LittleEndian.Uint16(raw[i*2:])
		}
		return strings.TrimSpace(string(utf16.Decode(u16)))
	}
	return strings.TrimSpace(string(raw))
}

func looksLikeUTF16LE(raw []byte) bool {
	if len(raw) < 2 {
		return false
	}
	for i := 1; i < len(raw) && i < 8; i += 2 {
		if raw[i] != 0 {
			return false
		}
	}
	return raw[0] != 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

// FallbackName derives a display name from the original upload filename.
func FallbackName(originalFilename string) string {
	base := strings.TrimSpace(originalFilename)
	base = filepath.Base(base)
	return strings.TrimSuffix(base, filepath.Ext(base))
}
