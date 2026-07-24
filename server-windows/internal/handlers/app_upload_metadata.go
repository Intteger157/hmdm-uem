package handlers

import (
	"strings"

	"github.com/hmdm/server-windows/internal/metadata"
)

func resolveUploadMetadata(destPath, originalName, overrideVersion, overridePublisher string) metadata.InstallerMetadata {
	manualVersion := strings.TrimSpace(overrideVersion)
	manualPublisher := strings.TrimSpace(overridePublisher)

	if manualVersion != "" && manualPublisher != "" {
		version := metadata.NormalizeVersion(manualVersion)
		if version == "" {
			version = manualVersion
		}
		return metadata.InstallerMetadata{
			Name:      metadata.FallbackName(originalName),
			Version:   version,
			Publisher: manualPublisher,
		}
	}

	parsed := metadata.ResolveInstallerMetadata(destPath, originalName)

	if manualVersion != "" {
		version := metadata.NormalizeVersion(manualVersion)
		if version == "" {
			version = manualVersion
		}
		parsed.Version = version
	}
	if manualPublisher != "" {
		parsed.Publisher = manualPublisher
	}

	return parsed
}
