//go:build windows

package policies

import (
	"fmt"
	"strings"
	"time"

	"golang.org/x/sys/windows/registry"
)

const (
	usbPolicyKeyPath      = `SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices`
	usbDenyAllValue       = "Deny_All"
	usbStorKeyPath        = `SYSTEM\CurrentControlSet\Services\USBSTOR`
	usbStorStartValue     = "Start"
	usbStorStartManual   = uint32(3)
	usbStorStartDisabled = uint32(4)
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

	if err := disableUSBStorDriver(); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("set USBSTOR Start: %v", err)}
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

func disableUSBStorDriver() error {
	return setUSBStorStart(usbStorStartDisabled)
}

func restoreUSBStorStart() error {
	current, found, err := readUSBStorStart()
	if err != nil {
		return err
	}
	if found && current == usbStorStartManual {
		return nil
	}
	return setUSBStorStart(usbStorStartManual)
}

func setUSBStorStart(value uint32) error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbStorKeyPath, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer key.Close()

	return key.SetDWordValue(usbStorStartValue, value)
}

func readUSBStorStart() (uint32, bool, error) {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbStorKeyPath, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return 0, false, nil
		}
		return 0, false, err
	}
	defer key.Close()

	value, _, err := key.GetIntegerValue(usbStorStartValue)
	if err != nil {
		if err == registry.ErrNotExist {
			return 0, false, nil
		}
		return 0, false, err
	}
	return uint32(value), true, nil
}

func readUSBBlocked() (bool, error) {
	policyBlocked := false
	if usbPolicyKeysPresent() {
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
		policyBlocked = value == 1
	}

	startValue, found, err := readUSBStorStart()
	if err != nil {
		return false, err
	}
	driverBlocked := found && startValue == usbStorStartDisabled
	return policyBlocked || driverBlocked, nil
}

func usbPolicyKeysPresent() bool {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbPolicyKeyPath, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return false
	}
	key.Close()
	return true
}
