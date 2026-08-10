package db

import "gorm.io/gorm"

func ensureWindowsDeviceCreatedAtSchema(database *gorm.DB) {
	database.Exec(`
		ALTER TABLE windows_devices
		ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

		UPDATE windows_devices
		SET created_at = COALESCE(
			NULLIF(last_checkin, TIMESTAMPTZ '0001-01-01 00:00:00+00'),
			NOW()
		)
		WHERE created_at IS NULL;

		ALTER TABLE windows_devices
		ALTER COLUMN created_at SET DEFAULT NOW();
	`)
}

func backfillWindowsDeviceCreatedAt(database *gorm.DB) {
	database.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'windows_devices'
				  AND column_name = 'created_at'
			) THEN
				RETURN;
			END IF;

			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'windows_enrollment_tokens'
				  AND column_name = 'used_by_hwid'
			) THEN
				UPDATE windows_devices wd
				SET created_at = COALESCE(
					(
						SELECT et.used_at
						FROM windows_enrollment_tokens et
						WHERE et.used_by_hwid = wd.hardware_id
						  AND et.used_at IS NOT NULL
						ORDER BY et.used_at ASC
						LIMIT 1
					),
					NULLIF(wd.last_checkin, TIMESTAMPTZ '0001-01-01 00:00:00+00'),
					wd.created_at,
					NOW()
				)
				WHERE created_at IS NULL
				   OR created_at = TIMESTAMPTZ '0001-01-01 00:00:00+00';
			ELSE
				UPDATE windows_devices wd
				SET created_at = COALESCE(
					NULLIF(wd.last_checkin, TIMESTAMPTZ '0001-01-01 00:00:00+00'),
					wd.created_at,
					NOW()
				)
				WHERE created_at IS NULL
				   OR created_at = TIMESTAMPTZ '0001-01-01 00:00:00+00';
			END IF;
		END $$;
	`)
}
