// Package testsupport provides helpers shared by the PostgreSQL integration
// tests. It is imported only from _test files and never linked into the server.
package testsupport

import (
	"fmt"
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DatabaseURLEnv names the environment variable holding the DSN of a throwaway
// PostgreSQL instance. Integration tests skip themselves when it is unset.
const DatabaseURLEnv = "HMDM_TEST_DATABASE_URL"

// OpenSchema connects to the test database with the session scoped to a private
// schema.
//
// Go runs the tests of different packages concurrently, and several packages
// install fixtures named after the same Java tables (users, userroles). Without
// a per-package schema they race each other into duplicate-key errors, deadlocks
// and cross-contaminated rows. The schema is dropped and recreated so each run
// starts clean.
func OpenSchema(t *testing.T, schema string) *gorm.DB {
	t.Helper()

	dsn := os.Getenv(DatabaseURLEnv)
	if dsn == "" {
		t.Skipf("%s is not set; skipping PostgreSQL integration test", DatabaseURLEnv)
	}

	config := &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)}

	admin, err := gorm.Open(postgres.Open(dsn), config)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	if err := admin.Exec(fmt.Sprintf(`DROP SCHEMA IF EXISTS %q CASCADE`, schema)).Error; err != nil {
		t.Fatalf("drop schema %q: %v", schema, err)
	}
	if err := admin.Exec(fmt.Sprintf(`CREATE SCHEMA %q`, schema)).Error; err != nil {
		t.Fatalf("create schema %q: %v", schema, err)
	}
	closeConnection(t, admin)

	scoped, err := gorm.Open(postgres.Open(fmt.Sprintf("%s search_path=%s", dsn, schema)), config)
	if err != nil {
		t.Fatalf("connect test schema %q: %v", schema, err)
	}
	t.Cleanup(func() { closeConnection(t, scoped) })

	return scoped
}

func closeConnection(t *testing.T, database *gorm.DB) {
	t.Helper()

	sqlDB, err := database.DB()
	if err != nil {
		return
	}
	if err := sqlDB.Close(); err != nil {
		t.Logf("close test connection: %v", err)
	}
}
