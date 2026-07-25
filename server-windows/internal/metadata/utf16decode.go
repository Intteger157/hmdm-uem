package metadata

import (
	"bytes"
	"encoding/binary"
	"strings"
	"unicode/utf16"
	"unicode/utf8"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"
)

var utf16LEDecoder = unicode.UTF16(unicode.LittleEndian, unicode.IgnoreBOM).NewDecoder()

func decodeUTF16LEBytes(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	if len(raw)%2 == 1 {
		raw = raw[:len(raw)-1]
	}
	if len(raw) == 0 {
		return ""
	}

	decoded, _, err := transform.Bytes(utf16LEDecoder, raw)
	if err == nil && utf8.Valid(decoded) {
		return sanitizeMetadataString(string(decoded))
	}

	runes := make([]uint16, len(raw)/2)
	for i := range runes {
		runes[i] = binary.LittleEndian.Uint16(raw[i*2:])
	}
	return sanitizeMetadataString(string(utf16.Decode(runes)))
}

func sanitizeMetadataString(value string) string {
	value = strings.TrimRight(value, "\x00")
	return strings.TrimSpace(value)
}

func sanitizeInstallerMetadata(meta InstallerMetadata) InstallerMetadata {
	meta.Name = sanitizeMetadataString(meta.Name)
	meta.Version = sanitizeMetadataString(meta.Version)
	meta.Publisher = sanitizeMetadataString(meta.Publisher)
	return meta
}

func sanitizeVersionResourceMap(resources map[string]string) map[string]string {
	if len(resources) == 0 {
		return resources
	}

	sanitized := make(map[string]string, len(resources))
	for key, value := range resources {
		sanitized[key] = sanitizeMetadataString(value)
	}
	return sanitized
}

func readUTF16StringAt(data []byte, offset int) string {
	if offset < 0 || offset+1 >= len(data) {
		return ""
	}
	if offset%2 == 1 {
		offset++
	}

	end := offset
	for end+1 < len(data) {
		if binary.LittleEndian.Uint16(data[end:end+2]) == 0 {
			break
		}
		end += 2
	}
	if end <= offset {
		return ""
	}
	return decodeUTF16LEBytes(data[offset:end])
}

func readUTF16ValueAfterKey(data []byte, keyUTF16Len int) string {
	offset := keyUTF16Len
	for offset+1 < len(data) {
		if binary.LittleEndian.Uint16(data[offset:offset+2]) != 0 {
			break
		}
		offset += 2
	}
	if offset%2 == 1 {
		offset++
	}
	return readUTF16StringAt(data, offset)
}

func utf16LEBytes(values []uint16) []byte {
	out := make([]byte, len(values)*2)
	for i, value := range values {
		binary.LittleEndian.PutUint16(out[i*2:], value)
	}
	return out
}

func readASCIIPropertyValue(data []byte, property string) string {
	needle := []byte(property)
	index := bytes.Index(data, needle)
	if index < 0 {
		return ""
	}

	tail := data[index+len(needle):]
	if len(tail) > 0 && tail[0] == 0 {
		tail = tail[1:]
	}
	end := bytes.IndexByte(tail, 0)
	if end < 0 {
		return sanitizeMetadataString(string(tail))
	}
	return sanitizeMetadataString(string(tail[:end]))
}
