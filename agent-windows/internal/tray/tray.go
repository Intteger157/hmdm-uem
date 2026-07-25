package tray

import (
	"fmt"
	"log"
	"net/url"
	"os/exec"
	"strings"

	"github.com/getlantern/systray"
	"github.com/hmdm/agent-windows/internal/agentstate"
	"github.com/hmdm/agent-windows/internal/brand"
	"github.com/hmdm/agent-windows/internal/config"
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

	mOpen := systray.AddMenuItem("Device Information", "Open device information page on MDM server")
	systray.AddSeparator()
	mVersion := systray.AddMenuItem("Version: "+brand.AgentVersion, "")
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
	pageURL, err := buildDeviceInformationURL()
	if err != nil {
		return err
	}
	log.Printf("opening public device information page: %s", pageURL)
	if err := exec.Command("rundll32", "url.dll,FileProtocolHandler", pageURL).Start(); err != nil {
		return fmt.Errorf("open browser: %w", err)
	}
	return nil
}

func buildDeviceInformationURL() (string, error) {
	cfg := config.LoadConfig(config.DebugOverrides{})
	serverURL := strings.TrimSpace(cfg.ServerURL)
	if serverURL == "" {
		return "", fmt.Errorf("server URL not configured")
	}

	state, err := agentstate.Load()
	if err != nil {
		return "", fmt.Errorf("load device id: %w", err)
	}
	deviceID := strings.TrimSpace(state.DeviceID)
	if deviceID == "" {
		return "", fmt.Errorf("device id not configured")
	}

	return buildDeviceInformationURLFrom(serverURL, deviceID)
}

func buildDeviceInformationURLFrom(serverURL, deviceID string) (string, error) {
	serverURL = strings.TrimSpace(serverURL)
	deviceID = strings.TrimSpace(deviceID)
	if serverURL == "" {
		return "", fmt.Errorf("server URL not configured")
	}
	if deviceID == "" {
		return "", fmt.Errorf("device id not configured")
	}
	if err := validatePublicServerURL(serverURL); err != nil {
		return "", err
	}

	base := strings.TrimRight(serverURL, "/")
	pageURL := base + "/device-info/" + url.PathEscape(deviceID)
	if err := validatePublicDeviceInfoPageURL(pageURL); err != nil {
		return "", err
	}
	return pageURL, nil
}

func validatePublicServerURL(serverURL string) error {
	lower := strings.ToLower(strings.TrimSpace(serverURL))
	if lower == "" {
		return fmt.Errorf("server URL not configured")
	}
	if strings.Contains(lower, ":49152") {
		return fmt.Errorf("legacy local device info port 49152 is disabled; configure ServerURL in registry")
	}
	if strings.Contains(lower, "127.0.0.1") || strings.Contains(lower, "localhost") {
		return fmt.Errorf("server URL must point to the MDM server, not localhost")
	}
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		return fmt.Errorf("server URL must start with http:// or https://")
	}
	return nil
}

func validatePublicDeviceInfoPageURL(pageURL string) error {
	lower := strings.ToLower(pageURL)
	if strings.Contains(lower, "127.0.0.1:49152") || strings.Contains(lower, ":49152") {
		return fmt.Errorf("refusing to open legacy local device info URL")
	}
	return nil
}
