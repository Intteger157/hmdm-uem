package metadata

import (
	"log"
	"path/filepath"
	"strings"
)

// ResolveInstallerMetadata extracts installer metadata using file contents first,
// then filename parsing, then a safe default version.
func ResolveInstallerMetadata(path, originalFilename string) InstallerMetadata {
	fileMeta := readInstallerMetadata(path)
	filenameMeta := ParseFilenameMetadata(originalFilename)

	meta := InstallerMetadata{
		Name:      resolveName(fileMeta.Name, filenameMeta.Name, originalFilename),
		Version:   resolveVersion(fileMeta.Version, filenameMeta.Version, originalFilename),
		Publisher: resolvePublisher(fileMeta.Publisher),
	}

	if fileMeta.Source == metadataSourceDefault && meta.Version == "" {
		log.Printf("[metadata] no embedded version metadata for %q", filepath.Base(originalFilename))
	}

	return meta
}

type metadataSource string

const (
	metadataSourceFile     metadataSource = "file"
	metadataSourceFilename metadataSource = "filename"
	metadataSourceDefault  metadataSource = "default"
)

type resolvedInstallerMetadata struct {
	InstallerMetadata
	Source metadataSource
}

func readInstallerMetadata(path string) resolvedInstallerMetadata {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".exe":
		return resolveExeMetadata(path)
	case ".msi":
		return resolveMsiMetadata(path)
	default:
		return resolvedInstallerMetadata{Source: metadataSourceDefault}
	}
}

func resolveExeMetadata(path string) resolvedInstallerMetadata {
	for _, parser := range []func(string) (InstallerMetadata, error){
		parseExeMetadataFileVersion,
		parseExeMetadata,
		parseExeMetadataDebugPE,
	} {
		parsed, err := parser(path)
		if err != nil {
			continue
		}
		parsed = sanitizeInstallerMetadata(parsed)
		parsed.Version = NormalizeVersion(parsed.Version)
		if parsed.Name != "" || parsed.Version != "" || parsed.Publisher != "" {
			return resolvedInstallerMetadata{InstallerMetadata: parsed, Source: metadataSourceFile}
		}
	}

	if scanned := scanMetadataFromBinary(readFileSample(path)); scanned.Name != "" || scanned.Version != "" || scanned.Publisher != "" {
		return resolvedInstallerMetadata{InstallerMetadata: sanitizeInstallerMetadata(scanned), Source: metadataSourceFile}
	}

	return resolvedInstallerMetadata{Source: metadataSourceDefault}
}

func resolveMsiMetadata(path string) resolvedInstallerMetadata {
	if parsed, err := parseMsiMetadataFromTables(path); err == nil {
		if parsed.Name != "" || parsed.Version != "" || parsed.Publisher != "" {
			return resolvedInstallerMetadata{InstallerMetadata: parsed, Source: metadataSourceFile}
		}
	}

	if parsed, err := parseMsiMetadataLegacy(path); err == nil {
		parsed.Version = NormalizeVersion(parsed.Version)
		if parsed.Name != "" || parsed.Version != "" || parsed.Publisher != "" {
			return resolvedInstallerMetadata{InstallerMetadata: parsed, Source: metadataSourceFile}
		}
	}

	if scanned := scanMetadataFromBinary(readFileSample(path)); scanned.Name != "" || scanned.Version != "" || scanned.Publisher != "" {
		return resolvedInstallerMetadata{InstallerMetadata: sanitizeInstallerMetadata(scanned), Source: metadataSourceFile}
	}

	return resolvedInstallerMetadata{Source: metadataSourceDefault}
}

func readFileSample(path string) []byte {
	data, err := readFilePrefix(path, 8<<20)
	if err != nil {
		return nil
	}
	return data
}
