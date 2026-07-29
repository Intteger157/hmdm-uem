package db

import (
	"testing"

	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
	"gorm.io/gorm"
)

// legacySchemaDDL recreates the parts of the Java Liquibase schema the role
// matrix migration has to coexist with, including the foreign keys that make a
// careless AutoMigrate dangerous.
const legacySchemaDDL = `
DROP TABLE IF EXISTS userrolepermissions, userroles, users CASCADE;

CREATE TABLE userRoles (
	id serial NOT NULL CONSTRAINT roles_pr_key PRIMARY KEY,
	name varchar(50) NOT NULL,
	description TEXT,
	superadmin BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE users (
	id serial NOT NULL CONSTRAINT users_pr_key PRIMARY KEY,
	login varchar(30) NOT NULL CONSTRAINT login_key UNIQUE,
	email varchar(50),
	name varchar(50),
	password varchar(32) NOT NULL,
	userRoleId INT REFERENCES userRoles( id ) ON DELETE RESTRICT,
	authToken varchar(40)
);

CREATE TABLE userRolePermissions (
	roleId INT NOT NULL REFERENCES userRoles( id ) ON DELETE CASCADE,
	permissionId INT NOT NULL
);

INSERT INTO userRoles (id, name, description, superadmin) VALUES (1, 'Super-Admin', 'Sees everything', TRUE);
INSERT INTO userRoles (id, name, description) VALUES (2, 'Admin', 'Full control panel access');
INSERT INTO userRoles (id, name, description) VALUES (3, 'User', 'Limited access');
INSERT INTO userRolePermissions (roleId, permissionId) VALUES (1, 1), (2, 3);
INSERT INTO users (login, name, password, userRoleId) VALUES ('admin', 'admin', 'x', 2);
ALTER SEQUENCE userroles_id_seq RESTART WITH 100;
`

// openLegacyTestDB installs the legacy Java schema in a private PostgreSQL
// schema. The test is skipped when no test database is configured so the default
// `go test ./...` run stays hermetic.
func openLegacyTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_db_rbac")
	if err := database.Exec(legacySchemaDDL).Error; err != nil {
		t.Fatalf("install legacy schema: %v", err)
	}

	return database
}

func TestMigrateRoleMatrixAgainstLegacySchema(t *testing.T) {
	database := openLegacyTestDB(t)

	if err := migrateRoleMatrix(database); err != nil {
		t.Fatalf("migrateRoleMatrix() error = %v", err)
	}

	t.Run("adds both matrix columns", func(t *testing.T) {
		for _, column := range []string{"platform_scope", "access_level"} {
			if !database.Migrator().HasColumn(&models.UserRole{}, column) {
				t.Errorf("column %q was not created", column)
			}
		}
	})

	t.Run("leaves legacy roles unrestricted", func(t *testing.T) {
		var role models.UserRole
		if err := database.First(&role, 2).Error; err != nil {
			t.Fatalf("load legacy role: %v", err)
		}
		if role.Name != "Admin" {
			t.Errorf("Name = %q, want %q (existing data was modified)", role.Name, "Admin")
		}
		if got := role.EffectivePlatformScope(); got != models.PlatformScopeGlobal {
			t.Errorf("PlatformScope = %q, want %q", got, models.PlatformScopeGlobal)
		}
		if got := role.EffectiveAccessLevel(); got != models.AccessLevelHigh {
			t.Errorf("AccessLevel = %q, want %q", got, models.AccessLevelHigh)
		}
	})

	t.Run("preserves the legacy id column type", func(t *testing.T) {
		// A full AutoMigrate would widen serial to bigserial and fight the
		// foreign keys pointing at userroles.id.
		var dataType string
		err := database.Raw(`
			SELECT data_type FROM information_schema.columns
			WHERE table_name = 'userroles' AND column_name = 'id'
		`).Scan(&dataType).Error
		if err != nil {
			t.Fatalf("inspect id column: %v", err)
		}
		if dataType != "integer" {
			t.Errorf("userroles.id data_type = %q, want %q", dataType, "integer")
		}
	})

	t.Run("preserves foreign keys and permission rows", func(t *testing.T) {
		var permissions int64
		if err := database.Table("userrolepermissions").Count(&permissions).Error; err != nil {
			t.Fatalf("count permissions: %v", err)
		}
		if permissions != 2 {
			t.Errorf("userrolepermissions rows = %d, want 2", permissions)
		}

		var constraints int64
		err := database.Raw(`
			SELECT COUNT(*) FROM information_schema.table_constraints
			WHERE table_name = 'userrolepermissions' AND constraint_type = 'FOREIGN KEY'
		`).Scan(&constraints).Error
		if err != nil {
			t.Fatalf("inspect foreign keys: %v", err)
		}
		if constraints == 0 {
			t.Error("foreign keys on userrolepermissions were dropped")
		}
	})

	t.Run("seeds the platform role matrix", func(t *testing.T) {
		for _, seed := range platformRoleSeeds {
			var role models.UserRole
			if err := database.Where("name = ?", seed.Name).First(&role).Error; err != nil {
				t.Errorf("role %q was not seeded: %v", seed.Name, err)
				continue
			}
			if role.PlatformScope != seed.PlatformScope {
				t.Errorf("role %q PlatformScope = %q, want %q", seed.Name, role.PlatformScope, seed.PlatformScope)
			}
			if role.AccessLevel != seed.AccessLevel {
				t.Errorf("role %q AccessLevel = %q, want %q", seed.Name, role.AccessLevel, seed.AccessLevel)
			}
		}
	})
}

func TestMigrateRoleMatrixIsIdempotent(t *testing.T) {
	database := openLegacyTestDB(t)

	for attempt := 1; attempt <= 3; attempt++ {
		if err := migrateRoleMatrix(database); err != nil {
			t.Fatalf("migrateRoleMatrix() attempt %d error = %v", attempt, err)
		}
	}

	var total int64
	if err := database.Model(&models.UserRole{}).Count(&total).Error; err != nil {
		t.Fatalf("count roles: %v", err)
	}

	want := int64(3 + len(platformRoleSeeds))
	if total != want {
		t.Errorf("role count = %d, want %d (seeding duplicated rows)", total, want)
	}
}

func TestMigrateRoleMatrixToleratesMissingLegacySchema(t *testing.T) {
	database := openLegacyTestDB(t)

	if err := database.Exec(`DROP TABLE IF EXISTS userrolepermissions, users, userroles CASCADE`).Error; err != nil {
		t.Fatalf("drop legacy schema: %v", err)
	}

	// A database without the Java schema must not stop the Windows server from
	// booting; admin routes simply reject every request.
	if err := migrateRoleMatrix(database); err != nil {
		t.Errorf("migrateRoleMatrix() error = %v, want nil when userroles is absent", err)
	}
}

func TestSeedRealignsDriftedMatrixValues(t *testing.T) {
	database := openLegacyTestDB(t)

	if err := migrateRoleMatrix(database); err != nil {
		t.Fatalf("migrateRoleMatrix() error = %v", err)
	}

	err := database.Model(&models.UserRole{}).
		Where("name = ?", "Windows Observer").
		Updates(map[string]any{"platform_scope": models.PlatformScopeAndroid, "access_level": models.AccessLevelHigh}).Error
	if err != nil {
		t.Fatalf("drift role: %v", err)
	}

	if err := seedPlatformRoles(database); err != nil {
		t.Fatalf("seedPlatformRoles() error = %v", err)
	}

	var role models.UserRole
	if err := database.Where("name = ?", "Windows Observer").First(&role).Error; err != nil {
		t.Fatalf("reload role: %v", err)
	}
	if role.PlatformScope != models.PlatformScopeWindows || role.AccessLevel != models.AccessLevelLow {
		t.Errorf("role = (%s, %s), want (windows, low)", role.PlatformScope, role.AccessLevel)
	}
}
