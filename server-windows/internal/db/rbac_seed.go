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
