package tray

import (
	"fmt"
	"log"
	"os/exec"

	"github.com/getlantern/systray"
	"github.com/hmdm/agent-windows/internal/desktop"
)

// Run starts the system tray UI. It blocks until the tray exits.
func Run(iconData []byte) {
	systray.Run(func() {
		onReady(iconData)
	}, onExit)
}

func onReady(iconData []byte) {
	systray.SetIcon(iconData)
	systray.SetTooltip("Singularity MDM Agent")

	mOpen := systray.AddMenuItem("Device Information", "Open local device information page")
	systray.AddSeparator()
	mVersion := systray.AddMenuItem("Version: "+desktop.AgentVersion, "")
	mVersion.Disable()

	go func() {
		for range mOpen.ClickedCh {
			if err := openDeviceInformationPage(); err != nil {
				log.Printf("open device information page failed: %v", err)
			}
		}
	}()
}

func onExit() {}

func openDeviceInformationPage() error {
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", desktop.LocalURL()).Start(); err != nil {
		return fmt.Errorf("open browser: %w", err)
	}
	return nil
}
