package db

import (
	"errors"
	"fmt"
	"log"

	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// platformRoleSeeds is the baseline RBAC matrix: one unrestricted global role
// plus a high/mid/low ladder per managed ecosystem. Seeds are matched by name,
// so operators can rename the legacy Java roles without collisions here.
var platformRoleSeeds = []models.UserRole{
	{
		Name:          "Global Administrator",
		Description:   seedDescription("Full access to every platform and every management function"),
		PlatformScope: models.PlatformScopeGlobal,
		AccessLevel:   models.AccessLevelHigh,
	},
	{
		Name:          "Windows Engineer",
		Description:   seedDescription("Full control over Windows devices, configurations and applications"),
		PlatformScope: models.PlatformScopeWindows,
		AccessLevel:   models.AccessLevelHigh,
	},
	{
		Name:          "Windows Operator",
		Description:   seedDescription("Day-to-day Windows device operations without configuration changes"),
		PlatformScope: models.PlatformScopeWindows,
		AccessLevel:   models.AccessLevelMid,
	},
	{
		Name:          "Windows Observer",
		Description:   seedDescription("Read-only visibility into Windows devices"),
		PlatformScope: models.PlatformScopeWindows,
		AccessLevel:   models.AccessLevelLow,
	},
	{
		Name:          "Android Engineer",
		Description:   seedDescription("Full control over Android devices, configurations and applications"),
		PlatformScope: models.PlatformScopeAndroid,
		AccessLevel:   models.AccessLevelHigh,
	},
	{
		Name:          "Android Operator",
		Description:   seedDescription("Day-to-day Android device operations without configuration changes"),
		PlatformScope: models.PlatformScopeAndroid,
		AccessLevel:   models.AccessLevelMid,
	},
	{
		Name:          "Android Observer",
		Description:   seedDescription("Read-only visibility into Android devices"),
		PlatformScope: models.PlatformScopeAndroid,
		AccessLevel:   models.AccessLevelLow,
	},
}

func seedDescription(text string) *string {
	return &text
}

// seedPlatformRoles inserts any missing baseline role and realigns the matrix
// columns of roles a previous run created. Roles that are not part of the
// baseline — including the legacy Java roles — are left untouched.
func seedPlatformRoles(database *gorm.DB) error {
	for _, seed := range platformRoleSeeds {
		var existing models.UserRole
		err := database.Where("LOWER(name) = LOWER(?)", seed.Name).First(&existing).Error

		if errors.Is(err, gorm.ErrRecordNotFound) {
			role := seed
			if err := database.Create(&role).Error; err != nil {
				return fmt.Errorf("seed role %q: %w", seed.Name, err)
			}
			log.Printf("[rbac] seeded role %q (scope=%s level=%s)", role.Name, role.PlatformScope, role.AccessLevel)
			continue
		}
		if err != nil {
			return fmt.Errorf("look up role %q: %w", seed.Name, err)
		}

		if existing.PlatformScope == seed.PlatformScope && existing.AccessLevel == seed.AccessLevel {
			continue
		}

		updates := map[string]any{
			"platform_scope": seed.PlatformScope,
			"access_level":   seed.AccessLevel,
		}
		if err := database.Model(&models.UserRole{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return fmt.Errorf("realign role %q: %w", seed.Name, err)
		}
		log.Printf("[rbac] realigned role %q (scope=%s level=%s)", seed.Name, seed.PlatformScope, seed.AccessLevel)
	}

	return nil
}

const (
	legacyAdminRoleID = 2
	legacyUserRoleID  = 3
)

// legacyPermissionSourceRoleID picks which legacy Java role donates permission
// rows. Global Administrator and platform Engineers mirror Admin; Operators and
// Observers mirror User so Tomcat allows read/search endpoints without granting
// settings-level access.
func legacyPermissionSourceRoleID(seed models.UserRole) uint {
	switch seed.AccessLevel {
	case models.AccessLevelHigh:
		return legacyAdminRoleID
	default:
		return legacyUserRoleID
	}
}

// seedLegacyRolePermissions copies userrolepermissions rows from the legacy Admin
// and User roles onto the seeded platform roles. Tomcat still authorises
// /rest/private/* via this join table; without rows the new RBAC roles get 403
// even when the Go matrix allows the action.
func seedLegacyRolePermissions(database *gorm.DB) error {
	migrator := database.Migrator()
	if !migrator.HasTable("userrolepermissions") {
		log.Printf("[rbac] userrolepermissions table is missing — skipping legacy permission seed")
		return nil
	}

	var adminPermCount int64
	if err := database.Table("userrolepermissions").Where("roleid = ?", legacyAdminRoleID).Count(&adminPermCount).Error; err != nil {
		return fmt.Errorf("count legacy admin permissions: %w", err)
	}
	if adminPermCount == 0 {
		log.Printf("[rbac] legacy Admin role (id=%d) has no permissions — skipping legacy permission seed", legacyAdminRoleID)
		return nil
	}

	for _, seed := range platformRoleSeeds {
		var target models.UserRole
		err := database.Where("LOWER(name) = LOWER(?)", seed.Name).First(&target).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		if err != nil {
			return fmt.Errorf("look up role %q for permissions: %w", seed.Name, err)
		}

		sourceRoleID := legacyPermissionSourceRoleID(seed)
		copied, err := copyLegacyRolePermissions(database, target.ID, sourceRoleID)
		if err != nil {
			return fmt.Errorf("seed permissions for role %q: %w", seed.Name, err)
		}
		if copied > 0 {
			log.Printf("[rbac] seeded %d legacy permission(s) for role %q (id=%d) from legacy role %d",
				copied, target.Name, target.ID, sourceRoleID)
		}
	}

	return nil
}

// copyLegacyRolePermissions inserts permission rows from sourceRoleID onto
// targetRoleID. The NOT EXISTS guard makes the copy idempotent because the Java
// schema does not declare a unique constraint on (roleid, permissionid).
func copyLegacyRolePermissions(database *gorm.DB, targetRoleID, sourceRoleID uint) (int64, error) {
	result := database.Exec(`
		INSERT INTO userrolepermissions (roleid, permissionid)
		SELECT ?, src.permissionid
		FROM userrolepermissions src
		WHERE src.roleid = ?
		AND NOT EXISTS (
			SELECT 1 FROM userrolepermissions existing
			WHERE existing.roleid = ? AND existing.permissionid = src.permissionid
		)
	`, targetRoleID, sourceRoleID, targetRoleID)
	if result.Error != nil {
		return 0, result.Error
	}
	return result.RowsAffected, nil
}
