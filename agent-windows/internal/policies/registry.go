//go:build windows

package policies

import (
	"golang.org/x/sys/windows/registry"
)

func deleteRegistryTree(root registry.Key, path string) error {
	key, err := registry.OpenKey(root, path, registry.ALL_ACCESS)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	defer key.Close()

	subkeys, err := key.ReadSubKeyNames(-1)
	if err != nil {
		return err
	}
	for _, subkey := range subkeys {
		if err := deleteRegistryTree(root, path+`\`+subkey); err != nil {
			return err
		}
	}

	if err := registry.DeleteKey(root, path); err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	return nil
}
