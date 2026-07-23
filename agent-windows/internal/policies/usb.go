//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"
)

const (
	usbPolicyKeyPath = `SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices`
	usbDenyAllValue  = "Deny_All"
	usbStorKeyPath   = `SYSTEM\CurrentControlSet\Services\USBSTOR`
	usbStorStartValue = "Start"
	usbStorStartDefault = uint32(3)
)

func enforceUSBBlock(block bool) Result {
	name := "USB"
	if block {
		return enableUSBBlock(name)
	}
	return removeUSBBlock(name)
}

func enableUSBBlock(name string) Result {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, usbPolicyKeyPath, registry.SET_VALUE)
	if err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("open registry key: %v", err)}
	}
	defer key.Close()

	if err := key.SetDWordValue(usbDenyAllValue, 1); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("set Deny_All: %v", err)}
	}
	return Result{Name: name, Success: true, Message: "removable storage blocked"}
}

func removeUSBBlock(name string) Result {
	if err := deleteRegistryTree(registry.LOCAL_MACHINE, usbPolicyKeyPath); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("remove policy key: %v", err)}
	}

	if err := restoreUSBStorStart(); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("restore USBSTOR Start: %v", err)}
	}

	output, err := runPowerShellScript(
		"$ErrorActionPreference = 'SilentlyContinue'; Update-HostStorageCache; 'Policy removed. Re-plug the USB drive if it is not immediately visible.'",
		2*time.Minute,
	)
	if err != nil {
		// Cache refresh is best-effort; policy keys are already removed.
		if strings.TrimSpace(output) == "" {
			output = "policy keys removed; USB cache refresh skipped"
		}
		return Result{Name: name, Success: true, Message: output}
	}
	if strings.TrimSpace(output) == "" {
		output = "policy removed. Re-plug the USB drive if it is not immediately visible."
	}
	return Result{Name: name, Success: true, Message: output}
}

func restoreUSBStorStart() error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbStorKeyPath, registry.SET_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	defer key.Close()

	current, _, err := key.GetIntegerValue(usbStorStartValue)
	if err != nil {
		if err == registry.ErrNotExist {
			return key.SetDWordValue(usbStorStartValue, usbStorStartDefault)
		}
		return err
	}
	if uint32(current) == usbStorStartDefault {
		return nil
	}
	return key.SetDWordValue(usbStorStartValue, usbStorStartDefault)
}

func readUSBBlocked() (bool, error) {
	if !usbPolicyKeysPresent() {
		return false, nil
	}

	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbPolicyKeyPath, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	defer key.Close()

	value, _, err := key.GetIntegerValue(usbDenyAllValue)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	return value == 1, nil
}

func usbPolicyKeysPresent() bool {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbPolicyKeyPath, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return false
	}
	key.Close()
	return true
}
