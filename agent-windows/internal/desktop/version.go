package desktop

const (
	// AgentVersion is shown on the local device information page and tray menu.
	AgentVersion = "1.0.25"
	// LocalHost binds the device info HTTP server to loopback only.
	LocalHost = "127.0.0.1"
	// LocalPort is the fixed port for the local device information page.
	LocalPort = "49152"
)

// LocalURL returns the loopback URL for the device information page.
func LocalURL() string {
	return "http://" + LocalHost + ":" + LocalPort + "/"
}
