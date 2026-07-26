//go:build windows

package setup

import (
	"fmt"
	"log"
	"path/filepath"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
	"golang.org/x/sys/windows/registry"
	"golang.org/x/sys/windows/svc/mgr"
)

const serviceDescription = "Singularity MDM agent for Windows device management"

// Install configures Windows service autostart/recovery and tray helper Run registry entry.
func Install(exePath string) error {
	exePath = filepath.Clean(exePath)
	if exePath == "" {
		return fmt.Errorf("agent executable path is required")
	}

	if err := ensureWindowsService(exePath); err != nil {
		return fmt.Errorf("configure windows service: %w", err)
	}
	log.Printf("[install] configured service %s for automatic start with recovery actions", brand.ServiceName)

	if err := installTrayAutostart(exePath); err != nil {
		return fmt.Errorf("configure tray autostart: %w", err)
	}
	log.Printf("[install] registered tray autostart %s=%q", brand.TrayRunValueName, TrayRunCommand(exePath))

	return nil
}

// RemoveTrayAutostart deletes the tray helper Run registry value.
func RemoveTrayAutostart() error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, brand.TrayRunKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open run key: %w", err)
	}
	defer key.Close()

	if err := key.DeleteValue(brand.TrayRunValueName); err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return fmt.Errorf("delete tray run value: %w", err)
	}

	log.Printf("[install] removed tray autostart registry value %s", brand.TrayRunValueName)
	return nil
}

func installTrayAutostart(exePath string) error {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, brand.TrayRunKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open run key: %w", err)
	}
	defer key.Close()

	return key.SetStringValue(brand.TrayRunValueName, TrayRunCommand(exePath))
}

func ensureWindowsService(exePath string) error {
	manager, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect service manager: %w", err)
	}
	defer manager.Disconnect()

	service, err := manager.OpenService(brand.ServiceName)
	if err != nil {
		service, err = manager.CreateService(brand.ServiceName, exePath, mgr.Config{
			DisplayName:  brand.ProductName,
			Description:  serviceDescription,
			StartType:    mgr.StartAutomatic,
			ErrorControl: mgr.ErrorNormal,
		})
		if err != nil {
			return fmt.Errorf("create service: %w", err)
		}
	} else {
		config, cfgErr := service.Config()
		if cfgErr != nil {
			service.Close()
			return fmt.Errorf("read service config: %w", cfgErr)
		}

		config.StartType = mgr.StartAutomatic
		config.BinaryPathName = exePath
		config.DisplayName = brand.ProductName
		config.Description = serviceDescription
		if err := service.UpdateConfig(config); err != nil {
			service.Close()
			return fmt.Errorf("update service config: %w", err)
		}
	}
	defer service.Close()

	recovery := []mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: time.Minute},
		{Type: mgr.ServiceRestart, Delay: time.Minute},
		{Type: mgr.ServiceRestart, Delay: time.Minute},
	}
	if err := service.SetRecoveryActions(recovery, uint32((24*time.Hour)/time.Second)); err != nil {
		return fmt.Errorf("set service recovery actions: %w", err)
	}

	return nil
}
