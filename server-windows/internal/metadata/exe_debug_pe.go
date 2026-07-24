package metadata

import (
	"bytes"
	"debug/pe"
	"encoding/binary"
	"errors"
	"os"
	"strings"
	"unicode/utf16"
)

var errPEFormat = errors.New("invalid PE format")

const (
	peResourceTypeVersion = 16
)

func parseExeMetadataDebugPE(path string) (InstallerMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return InstallerMetadata{}, err
	}
	defer file.Close()

	peFile, err := pe.NewFile(file)
	if err != nil {
		return InstallerMetadata{}, err
	}

	resourceData, err := readPEVersionResource(peFile)
	if err != nil {
		return InstallerMetadata{}, err
	}

	return parseVSVersionInfo(resourceData)
}

func readPEVersionResource(file *pe.File) ([]byte, error) {
	section := file.Section(".rsrc")
	if section == nil {
		return nil, errPEFormat
	}

	data, err := section.Data()
	if err != nil {
		return nil, err
	}

	resourceRVA, ok := peResourceDirectoryRVA(file)
	if !ok {
		return nil, errPEFormat
	}

	dirOffset := int(resourceRVA - section.VirtualAddress)
	if dirOffset < 0 || dirOffset >= len(data) {
		return nil, errPEFormat
	}

	return findVersionResourceData(data[dirOffset:])
}

func peResourceDirectoryRVA(file *pe.File) (uint32, bool) {
	switch header := file.OptionalHeader.(type) {
	case *pe.OptionalHeader32:
		return header.DataDirectory[pe.IMAGE_DIRECTORY_ENTRY_RESOURCE].VirtualAddress, true
	case *pe.OptionalHeader64:
		return header.DataDirectory[pe.IMAGE_DIRECTORY_ENTRY_RESOURCE].VirtualAddress, true
	default:
		return 0, false
	}
}

func findVersionResourceData(resourceDir []byte) ([]byte, error) {
	if len(resourceDir) < 16 {
		return nil, errPEFormat
	}

	typeCount := binary.LittleEndian.Uint16(resourceDir[12:14])
	entryBase := 16
	for i := 0; i < int(typeCount); i++ {
		offset := entryBase + i*8
		if offset+8 > len(resourceDir) {
			break
		}
		entryName := binary.LittleEndian.Uint32(resourceDir[offset : offset+4])
		entryOffset := binary.LittleEndian.Uint32(resourceDir[offset+4 : offset+8])
		if entryName != peResourceTypeVersion {
			continue
		}
		if int(entryOffset) >= len(resourceDir) {
			continue
		}
		return findFirstResourceLeaf(resourceDir[entryOffset&0x7FFFFFFF:])
	}

	return nil, errPEFormat
}

func findFirstResourceLeaf(node []byte) ([]byte, error) {
	if len(node) < 16 {
		return nil, errPEFormat
	}

	nameCount := binary.LittleEndian.Uint16(node[14:16])
	if nameCount == 0 {
		return nil, errPEFormat
	}

	childOffset := binary.LittleEndian.Uint32(node[16+4 : 16+8])
	if int(childOffset&0x7FFFFFFF) >= len(node) {
		return nil, errPEFormat
	}
	child := node[childOffset&0x7FFFFFFF:]

	if len(child) < 16 {
		return nil, errPEFormat
	}
	langCount := binary.LittleEndian.Uint16(child[14:16])
	if langCount == 0 {
		return nil, errPEFormat
	}
	leafOffset := binary.LittleEndian.Uint32(child[16+4 : 16+8])
	if int(leafOffset&0x7FFFFFFF) >= len(node) {
		return nil, errPEFormat
	}
	leaf := node[leafOffset&0x7FFFFFFF:]
	if len(leaf) < 16 {
		return nil, errPEFormat
	}

	dataRVA := binary.LittleEndian.Uint32(leaf[0:4])
	dataSize := binary.LittleEndian.Uint32(leaf[4:8])
	if dataSize == 0 || int(dataRVA) >= len(node) {
		return nil, errPEFormat
	}
	end := int(dataRVA) + int(dataSize)
	if end > len(node) {
		end = len(node)
	}
	return node[dataRVA:end], nil
}

func parseVSVersionInfo(data []byte) (InstallerMetadata, error) {
	stringsMap := extractVersionStringMap(data)
	if len(stringsMap) == 0 {
		return InstallerMetadata{}, errPEFormat
	}

	return InstallerMetadata{
		Name:      firstNonEmpty(stringsMap["ProductName"], stringsMap["FileDescription"], stringsMap["InternalName"]),
		Version:   NormalizeVersion(firstNonEmpty(stringsMap["ProductVersion"], stringsMap["FileVersion"])),
		Publisher: firstNonEmpty(stringsMap["CompanyName"], stringsMap["LegalCopyright"]),
	}, nil
}

func extractVersionStringMap(data []byte) map[string]string {
	result := make(map[string]string)
	keys := []string{
		"CompanyName",
		"FileDescription",
		"FileVersion",
		"InternalName",
		"LegalCopyright",
		"OriginalFilename",
		"ProductName",
		"ProductVersion",
	}

	for _, key := range keys {
		if value := scanStringProperty(data, key); value != "" {
			result[key] = value
		}
	}

	return result
}

func scanStringProperty(data []byte, property string) string {
	if value := scanUTF16PropertyString(data, property); value != "" {
		return value
	}
	needle := []byte(property)
	index := bytes.Index(data, needle)
	if index < 0 {
		return ""
	}
	return readNearbyString(data[index:])
}

func scanUTF16PropertyString(data []byte, property string) string {
	needle := utf16LEBytes(utf16.Encode([]rune(property)))
	for i := 0; i+len(needle) <= len(data); i++ {
		if !bytes.Equal(data[i:i+len(needle)], needle) {
			continue
		}
		if value := readNearbyString(data[i:]); value != "" && !strings.EqualFold(value, property) {
			return value
		}
	}
	return ""
}

func readNearbyString(chunk []byte) string {
	if len(chunk) > 4096 {
		chunk = chunk[:4096]
	}
	return firstUTF16StringAfter(chunk, len(chunk)/8)
}
