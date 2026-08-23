package brand

const (
	TrayRunValueName   = "SingularityMDMTray"
	TrayRunKeyPath     = `SOFTWARE\Microsoft\Windows\CurrentVersion\Run`
	trayExecutableName = "singularity-agent.exe"
)

// TrayExecutableName returns the on-disk agent binary file name.
func TrayExecutableName() string {
	return trayExecutableName
}
