// Package config stores agent settings and enrollment credentials.
package config

import (
	"fmt"

	"github.com/hmdm/agent-windows/internal/brand"
	"golang.org/x/sys/windows/registry"
)

const (
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

// DebugOverrides supplies CLI values used when registry keys are missing (debug mode).
type DebugOverrides struct {
	ServerURL       string
	EnrollmentToken string
}

// LoadConfig reads agent settings from the registry with optional CLI fallbacks for debugging.
func LoadConfig(overrides DebugOverrides) Config {
	cfg := Config{
		ServerURL: defaultServerURL,
	}

	if serverURL := readRegistryString(registryServerURL); serverURL != "" {
		cfg.ServerURL = normalizeServerURL(serverURL)
	} else if overrides.ServerURL != "" {
		cfg.ServerURL = normalizeServerURL(overrides.ServerURL)
	}

	cfg.EnrollmentToken = readRegistryString(registryEnrollmentToken)
	if cfg.EnrollmentToken == "" {
		cfg.EnrollmentToken = overrides.EnrollmentToken
	}

	cfg.AuthToken = readRegistryString(registryAuthToken)

	return cfg
}

// SaveAuthToken persists the JWT returned by enrollment.
func SaveAuthToken(token string) error {
	if err := writeRegistryString(registryAuthToken, token); err != nil {
		return err
	}
	return nil
}

// ClearAuthToken removes the stored JWT so the agent can enroll again.
func ClearAuthToken() error {
	for _, keyPath := range brand.RegistryKeyPaths() {
		key, err := registry.OpenKey(registry.LOCAL_MACHINE, keyPath, registry.SET_VALUE)
		if err != nil {
			continue
		}
		if err := key.DeleteValue(registryAuthToken); err != nil && err != registry.ErrNotExist {
			key.Close()
			return fmt.Errorf("delete auth token: %w", err)
		}
		key.Close()
	}
	return nil
}

func readRegistryString(name string) string {
	for _, keyPath := range brand.RegistryKeyPaths() {
		if value := readRegistryStringAt(keyPath, name); value != "" {
			return value
		}
	}
	return ""
}

func readRegistryStringAt(keyPath, name string) string {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, keyPath, registry.QUERY_VALUE)
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

func writeRegistryString(name, value string) error {
	key, _, err := registry.CreateKey(registry.LOCAL_MACHINE, brand.RegistryKeyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open registry key: %w", err)
	}
	defer key.Close()

	if err := key.SetStringValue(name, value); err != nil {
		return fmt.Errorf("write %s: %w", name, err)
	}

	return nil
}
