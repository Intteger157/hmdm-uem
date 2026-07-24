//go:build !windows

package metadata

func parseExeMetadataFileVersion(path string) (InstallerMetadata, error) {
	return InstallerMetadata{}, errPEFormat
}
