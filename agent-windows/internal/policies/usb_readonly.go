//go:build windows

package policies

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

const (
	usbReadOnlyKeyPath    = `SYSTEM\CurrentControlSet\Control\StorageDevicePolicies`
	usbWriteProtectValue  = "WriteProtect"
)

func enforceUsbReadOnly(enabled bool) Result {
	name := "USB Read-Only"
	if enabled {
		return enableUsbReadOnly(name)
	}
	return disableUsbReadOnly(name)
}

func enableUsbReadOnly(name string) Result {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, usbReadOnlyKeyPath, registry.SET_VALUE)
	if err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("open registry key: %v", err)}
	}
	defer key.Close()

	if err := key.SetDWordValue(usbWriteProtectValue, 1); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("set WriteProtect: %v", err)}
	}
	return Result{Name: name, Success: true, Message: "USB storage write-protected"}
}

func disableUsbReadOnly(name string) Result {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbReadOnlyKeyPath, registry.SET_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return Result{Name: name, Success: true, Message: "USB Write Access restored"}
		}
		return Result{Name: name, Success: false, Message: fmt.Sprintf("open registry key: %v", err)}
	}
	defer key.Close()

	if err := key.DeleteValue(usbWriteProtectValue); err != nil {
		if err == registry.ErrNotExist {
			return Result{Name: name, Success: true, Message: "USB Write Access restored"}
		}
		if setErr := key.SetDWordValue(usbWriteProtectValue, 0); setErr != nil {
			return Result{Name: name, Success: false, Message: fmt.Sprintf("restore write access: %v", setErr)}
		}
	}
	return Result{Name: name, Success: true, Message: "USB Write Access restored"}
}

func readUsbReadOnly() (bool, error) {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, usbReadOnlyKeyPath, registry.QUERY_VALUE)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	defer key.Close()

	value, _, err := key.GetIntegerValue(usbWriteProtectValue)
	if err != nil {
		if err == registry.ErrNotExist {
			return false, nil
		}
		return false, err
	}
	return value == 1, nil
}
