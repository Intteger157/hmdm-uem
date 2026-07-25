// Package brand holds install paths and product naming for the Windows agent.
package brand

import (
	"io"
	"os"
	"path/filepath"
)

const (
	RegistryKeyPath        = `SOFTWARE\Singularity MDM\Agent`
	RegistryKeyPathWOW6432 = `SOFTWARE\WOW6432Node\Singularity MDM\Agent`

	programDataDirName = "Singularity MDM Agent"
	installDirName     = "Singularity MDM Agent"
)

// RegistryKeyPaths returns registry locations in read priority order.
func RegistryKeyPaths() []string {
	paths := []string{
		RegistryKeyPath,
		RegistryKeyPathWOW6432,
	}
	return append(paths, LegacyRegistryKeyPaths()...)
}

// ProgramDataDir returns the agent data directory under ProgramData.
func ProgramDataDir() string {
	return filepath.Join(programDataRoot(), programDataDirName)
}

func programDataRoot() string {
	if root := os.Getenv("PROGRAMDATA"); root != "" {
		return root
	}
	return `C:\ProgramData`
}

// InstallDirName is the folder under Program Files that contains singularity-agent.exe.
func InstallDirName() string {
	return installDirName
}

// EnsureProgramDataDir creates the data directory and migrates files from the legacy path.
func EnsureProgramDataDir() (string, error) {
	dir := ProgramDataDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	migrateDataFiles(LegacyProgramDataDir(), dir)
	return dir, nil
}

// ResolveDataPath returns the best on-disk path for reading a data file.
func ResolveDataPath(filename string) string {
	newPath := filepath.Join(ProgramDataDir(), filename)
	if _, err := os.Stat(newPath); err == nil {
		return newPath
	}

	legacyPath := filepath.Join(LegacyProgramDataDir(), filename)
	if _, err := os.Stat(legacyPath); err == nil {
		return legacyPath
	}

	return newPath
}

func migrateDataFiles(fromDir, toDir string) {
	entries, err := os.ReadDir(fromDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		src := filepath.Join(fromDir, entry.Name())
		dst := filepath.Join(toDir, entry.Name())
		if _, err := os.Stat(dst); err == nil {
			continue
		}
		_ = copyFile(src, dst)
	}
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	defer out.Close()

	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Close()
}
