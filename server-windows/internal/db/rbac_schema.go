package db

import (
	"errors"
	"fmt"
	"log"

	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

var errRoleTableMissing = errors.New("userroles table not found")

// matrixColumns are the GORM field names backing the RBAC matrix.
var matrixColumns = []string{"PlatformScope", "AccessLevel"}

// ensureRoleMatrixSchema adds the platform scope and access level columns to the
// role table.
//
// The table is created by the legacy Java Liquibase migrations and is referenced
// by foreign keys from users, userrolepermissions and userrolesettings. A full
// AutoMigrate would also try to reconcile the pre-existing id/name/description
// types against that schema, so only the two new columns are added here. Adding
// columns is purely additive: existing roles and their permissions survive, and
// the column defaults keep them unrestricted exactly as they were before.
func ensureRoleMatrixSchema(database *gorm.DB) error {
	migrator := database.Migrator()
	if !migrator.HasTable(&models.UserRole{}) {
		return errRoleTableMissing
	}

	for _, column := range matrixColumns {
		if migrator.HasColumn(&models.UserRole{}, column) {
			continue
		}
		if err := migrator.AddColumn(&models.UserRole{}, column); err != nil {
			return fmt.Errorf("add userroles column %s: %w", column, err)
		}
		log.Printf("[rbac] added userroles column for %s", column)
	}

	return nil
}

// migrateRoleMatrix brings the role matrix schema and seed data up to date. A
// missing role table means the legacy Java schema was never installed against
// this database, which is not fatal for the Windows server itself — but every
// admin route will then reject requests, so it is logged loudly.
func migrateRoleMatrix(database *gorm.DB) error {
	if err := ensureRoleMatrixSchema(database); err != nil {
		if errors.Is(err, errRoleTableMissing) {
			log.Printf("[rbac] userroles table is missing — skipping role matrix migration; admin API authentication will reject all requests until the Java schema is installed")
			return nil
		}
		return err
	}

	return seedPlatformRoles(database)
}
