// Package config stores agent settings and enrollment credentials.
package config

import (
	"fmt"

	"golang.org/x/sys/windows/registry"
)

const (
	registryKeyPath         = `SOFTWARE\HMDM\Agent`
	registryEnrollmentToken = "EnrollmentToken"
	registryAuthToken       = "AuthToken"
	registryServerURL       = "ServerURL"
	defaultServerURL        = "http://localhost:8080"
)

// Config holds runtime configuration loaded from disk or the registry.
type Config struct {
	ServerURL       string
	EnrollmentToken string
	AuthToken       string
	HardwareID      string
}

// LoadConfig reads agent settings from the registry with CLI fallbacks for debugging.
func LoadConfig(cliEnrollmentToken string) Config {
	cfg := Config{
		ServerURL: defaultServerURL,
	}

	if serverURL := readRegistryString(registryServerURL); serverURL != "" {
		cfg.ServerURL = serverURL
	}

	cfg.EnrollmentToken = readRegistryString(registryEnrollmentToken)
	if cfg.EnrollmentToken == "" {
		cfg.EnrollmentToken = cliEnrollmentToken
	}

	cfg.AuthToken = readRegistryString(registryAuthToken)

	return cfg
}

// SaveAuthToken persists the JWT returned by enrollment.
func SaveAuthToken(token string) error {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, registryKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open registry key: %w", err)
	}
	defer key.Close()

	if err := key.SetStringValue(registryAuthToken, token); err != nil {
		return fmt.Errorf("write auth token: %w", err)
	}

	return nil
}

// ClearAuthToken removes the stored JWT so the agent can enroll again.
func ClearAuthToken() error {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, registryKeyPath, registry.SET_VALUE)
	if err != nil {
		return nil
	}
	defer key.Close()

	if err := key.DeleteValue(registryAuthToken); err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return fmt.Errorf("delete auth token: %w", err)
	}

	return nil
}

func readRegistryString(name string) string {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, registryKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return ""
	}
	defer key.Close()

	value, _, err := key.GetStringValue(name)
	if err != nil {
		return ""
	}

	return value
}
