package brand

import "path/filepath"

// Legacy install locations from builds before the Singularity MDM rebrand.
// Read-only migration paths; new installs must not write here.
const (
	legacyServiceName            = "HMDMAgent"
	legacyRegistryKeyPath        = `SOFTWARE\HMDM\Agent`
	legacyRegistryKeyPathWOW6432 = `SOFTWARE\WOW6432Node\HMDM\Agent`
)

// LegacyServiceName is the pre-rebrand Windows service name removed during upgrade.
func LegacyServiceName() string {
	return legacyServiceName
}

// LegacyRegistryKeyPaths returns registry keys used by older agent builds.
func LegacyRegistryKeyPaths() []string {
	return []string{legacyRegistryKeyPath, legacyRegistryKeyPathWOW6432}
}

// LegacyProgramDataDir returns the pre-rebrand ProgramData folder.
func LegacyProgramDataDir() string {
	root := programDataRoot()
	return filepath.Join(root, "HMDM", "Agent")
}
