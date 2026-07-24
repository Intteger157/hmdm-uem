package metadata

import (
	fileversion "github.com/bi-zone/go-fileversion"
)

func parseExeMetadataFileVersion(path string) (InstallerMetadata, error) {
	info, err := fileversion.New(path)
	if err != nil {
		return InstallerMetadata{}, err
	}

	fixed := info.FixedInfo()
	version := firstNonEmpty(
		NormalizeVersion(info.ProductVersion()),
		NormalizeVersion(info.FileVersion()),
		NormalizeVersion(fixed.ProductVersion.String()),
		NormalizeVersion(fixed.FileVersion.String()),
	)

	meta := InstallerMetadata{
		Name:      firstNonEmpty(info.ProductName(), info.FileDescription(), info.InternalName()),
		Version:   version,
		Publisher: firstNonEmpty(info.CompanyName(), info.LegalCopyright()),
	}
	if meta.Name == "" && meta.Version == "" && meta.Publisher == "" {
		return InstallerMetadata{}, errPEFormat
	}
	return meta, nil
}
