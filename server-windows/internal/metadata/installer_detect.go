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
	nsisExeheadSignature   = []byte("Nullsoft.NSIS.exehead")
	innoSetupSignature     = []byte("Inno Setup")
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

	sample, err := readInstallerSample(path, maxInstallerScanBytes)
	if err != nil {
		return "", err
	}

	lowerSample := bytes.ToLower(sample)

	switch {
	case bytes.Contains(sample, innoSetupSignature):
		return "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART", nil
	case bytes.Contains(sample, installShieldSignature):
		return `/s /v"/qn"`, nil
	case bytes.Contains(lowerSample, []byte("wix toolset")) || bytes.Contains(lowerSample, []byte("burn")):
		return "-quiet -norestart", nil
	case bytes.Contains(sample, nsisExeheadSignature),
		bytes.Contains(sample, []byte("Nullsoft")),
		bytes.Contains(sample, []byte("NSIS")):
		return "/S", nil
	default:
		return "", nil
	}
}

func readInstallerSample(path string, maxBytes int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, err
	}

	var sample bytes.Buffer
	prefix, err := io.ReadAll(io.LimitReader(file, maxBytes))
	if err != nil {
		return nil, err
	}
	sample.Write(prefix)

	if info.Size() > maxBytes {
		suffixOffset := info.Size() - maxBytes
		if _, err := file.Seek(suffixOffset, io.SeekStart); err != nil {
			return nil, err
		}
		suffix, err := io.ReadAll(io.LimitReader(file, maxBytes))
		if err != nil {
			return nil, err
		}
		sample.Write(suffix)
	}

	return sample.Bytes(), nil
}
