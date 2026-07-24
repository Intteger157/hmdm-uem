package db

import "gorm.io/gorm"

func ensureEnrollmentSettingsSchema(database *gorm.DB) {
	database.Exec(`
		CREATE TABLE IF NOT EXISTS windows_enrollment_provisioning_settings (
			id BIGSERIAL PRIMARY KEY,
			create_local_admin BOOLEAN NOT NULL DEFAULT FALSE,
			admin_username TEXT NOT NULL DEFAULT '',
			admin_password TEXT NOT NULL DEFAULT '',
			enrollment_mode TEXT NOT NULL DEFAULT 'token',
			enrollment_secret TEXT NOT NULL DEFAULT '',
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
	`)

	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS create_local_admin BOOLEAN NOT NULL DEFAULT FALSE;
	`)
	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS admin_username TEXT NOT NULL DEFAULT '';
	`)
	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS admin_password TEXT NOT NULL DEFAULT '';
	`)
	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS enrollment_mode TEXT NOT NULL DEFAULT 'token';
	`)
	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS enrollment_secret TEXT NOT NULL DEFAULT '';
	`)
	database.Exec(`
		ALTER TABLE windows_enrollment_provisioning_settings
		ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
	`)
}
