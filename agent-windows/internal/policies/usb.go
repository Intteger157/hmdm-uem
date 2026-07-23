//go:build windows

package policies

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

const (
	usbPolicyKeyPath = `SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices`
	usbDenyAllValue  = "Deny_All"
)

func enforceUSBBlock(block bool) Result {
	name := "USB"
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, usbPolicyKeyPath, registry.SET_VALUE)
	if err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("open registry key: %v", err)}
	}
	defer key.Close()

	value := uint32(0)
	if block {
		value = 1
	}
	if err := key.SetDWordValue(usbDenyAllValue, value); err != nil {
		return Result{Name: name, Success: false, Message: fmt.Sprintf("set Deny_All: %v", err)}
	}

	state := "allowed"
	if block {
		state = "blocked"
	}
	return Result{Name: name, Success: true, Message: fmt.Sprintf("removable storage %s", state)}
}

func readUSBBlocked() (bool, error) {
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
