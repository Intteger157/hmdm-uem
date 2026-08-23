package db

import "gorm.io/gorm"

func ensureWindowsDeviceAgentAuthSchema(database *gorm.DB) {
	database.Exec(`
		ALTER TABLE windows_devices
		ADD COLUMN IF NOT EXISTS agent_token_hash VARCHAR(64);

		ALTER TABLE windows_devices
		ADD COLUMN IF NOT EXISTS agent_version VARCHAR(32);
	`)
}
