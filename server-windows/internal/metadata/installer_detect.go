package metadata

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"strings"
)

const maxInstallerScanBytes = 2 << 20

var (
	nsisSignature         = []byte("Nullsoft.NSIS.exehead")
	innoSetupSignature    = []byte("Inno Setup")
	installShieldSignature = []byte("InstallShield")
)

// DetectInstallerArgs scans the uploaded installer and returns suggested silent install arguments.
func DetectInstallerArgs(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))
	if ext == ".msi" {
		return "/quiet /norestart", nil
	}
	if ext != ".exe" {
		return "", nil
	}

	sample, err := readFilePrefix(path, maxInstallerScanBytes)
	if err != nil {
		return "", err
	}

	switch {
	case bytes.Contains(sample, nsisSignature):
		return "/S", nil
	case bytes.Contains(sample, innoSetupSignature):
		return "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART", nil
	case bytes.Contains(sample, installShieldSignature):
		return `/s /v"/qn"`, nil
	default:
		return "", nil
	}
}

func readFilePrefix(path string, maxBytes int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	return io.ReadAll(io.LimitReader(file, maxBytes))
}
