package main

import (
	"log"

	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/config"
)

func migrateAuthTokenIfNeeded(cfg *config.Config, apiClient *api.APIClient) {
	if cfg == nil || apiClient == nil {
		return
	}
	if cfg.HardwareID == "" {
		return
	}
	if !api.IsLegacyAuthToken(cfg.AuthToken) {
		return
	}

	current := cfg.AuthToken
	if current == "" {
		return
	}

	newToken, err := apiClient.RefreshAuthToken(current, cfg.HardwareID)
	if err != nil {
		log.Printf("auth token migration skipped: %v", err)
		return
	}

	if err := config.SaveAuthToken(newToken); err != nil {
		log.Printf("auth token migration persist failed: %v", err)
		return
	}

	cfg.AuthToken = newToken
	log.Printf("auth token migrated to secure per-device credential")
}
