package metadata

import (
	"fmt"
	"path/filepath"
	"strings"
)

// ValidateInstallerFile reports an error when embedded EXE/MSI metadata cannot be read.
func ValidateInstallerFile(path, originalFilename string) error {
	fileMeta := readInstallerMetadata(path)
	if fileMeta.Source != metadataSourceFile {
		return fmt.Errorf("unable to read installer metadata from %q", filepath.Base(originalFilename))
	}

	meta := sanitizeInstallerMetadata(fileMeta.InstallerMetadata)
	if strings.TrimSpace(meta.Name) == "" && strings.TrimSpace(meta.Version) == "" {
		return fmt.Errorf("installer metadata is empty for %q", filepath.Base(originalFilename))
	}

	return nil
}
