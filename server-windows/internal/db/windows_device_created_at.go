package db

import "gorm.io/gorm"

func backfillWindowsDeviceCreatedAt(database *gorm.DB) {
	database.Exec(`
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
			NOW()
		)
		WHERE created_at IS NULL
		   OR created_at = TIMESTAMPTZ '0001-01-01 00:00:00+00';
	`)
}
