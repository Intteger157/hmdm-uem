package tray

import (
	"fmt"
	"log"
	"net/url"
	"os/exec"
	"strings"

	"github.com/getlantern/systray"
	"github.com/hmdm/agent-windows/internal/agentstate"
	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/system"
)

const agentVersion = "1.0"

// Run starts the system tray UI. It blocks until the tray exits.
func Run(cfg config.Config, iconData []byte) {
	systray.Run(func() {
		onReady(cfg, iconData)
	}, onExit)
}

func onReady(cfg config.Config, iconData []byte) {
	systray.SetIcon(iconData)
	systray.SetTooltip("Singularity MDM Agent")

	mOpen := systray.AddMenuItem("Open Device Info", "Open MDM portal")
	systray.AddSeparator()
	mVersion := systray.AddMenuItem("Version: "+agentVersion, "")
	mVersion.Disable()

	go func() {
		for range mOpen.ClickedCh {
			if err := openDevicePortal(cfg); err != nil {
				log.Printf("open device portal failed: %v", err)
			}
		}
	}()
}

func onExit() {}

func openDevicePortal(cfg config.Config) error {
	deviceID, err := resolveDeviceID()
	if err != nil {
		return err
	}

	portalURL := buildDevicePortalURL(cfg.ServerURL, deviceID)
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", portalURL).Start(); err != nil {
		return fmt.Errorf("open browser: %w", err)
	}

	return nil
}

func resolveDeviceID() (string, error) {
	if state, err := agentstate.Load(); err == nil && state.DeviceID != "" {
		return state.DeviceID, nil
	}

	hardwareID, err := system.GetHardwareID()
	if err != nil {
		return "", fmt.Errorf("resolve device id: %w", err)
	}

	return hardwareID, nil
}

func buildDevicePortalURL(serverURL, deviceID string) string {
	base := strings.TrimRight(strings.TrimSpace(serverURL), "/")
	return fmt.Sprintf("%s/devices/%s?platform=windows", base, url.PathEscape(deviceID))
}
