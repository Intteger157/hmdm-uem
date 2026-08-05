package handlers

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
)

type consolePermission struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type consoleRoleItem struct {
	ID          uint                `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description,omitempty"`
	SuperAdmin  bool                `json:"superAdmin"`
	Permissions []consolePermission `json:"permissions"`
}

type consoleRoleListResponse struct {
	Items []consoleRoleItem `json:"items"`
}

type permissionRow struct {
	RoleID         uint   `gorm:"column:roleid"`
	PermissionID   uint   `gorm:"column:permissionid"`
	PermissionName string `gorm:"column:permissionname"`
}

// ListConsoleRoles returns every console role for the Roles and Settings screens.
func (h *WindowsHandler) ListConsoleRoles(c *gin.Context) {
	var roles []models.UserRole
	if err := db.DB.Order("id ASC").Find(&roles).Error; err != nil {
		log.Printf("[console-roles] list failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list roles"})
		return
	}

	permissionMap := map[uint][]consolePermission{}
	var permissionRows []permissionRow
	if err := db.DB.Table("userrolepermissions urp").
		Select("urp.roleid, p.id AS permissionid, p.name AS permissionname").
		Joins("JOIN permissions p ON p.id = urp.permissionid").
		Order("urp.roleid ASC, p.id ASC").
		Scan(&permissionRows).Error; err != nil {
		log.Printf("[console-roles] permissions lookup failed: %v", err)
	} else {
		for _, row := range permissionRows {
			permissionMap[row.RoleID] = append(permissionMap[row.RoleID], consolePermission{
				ID:   row.PermissionID,
				Name: row.PermissionName,
			})
		}
	}

	items := make([]consoleRoleItem, 0, len(roles))
	for _, role := range roles {
		item := consoleRoleItem{
			ID:          role.ID,
			Name:        role.Name,
			SuperAdmin:  role.SuperAdmin,
			Permissions: permissionMap[role.ID],
		}
		if role.Description != nil {
			item.Description = *role.Description
		}
		if item.Permissions == nil {
			item.Permissions = []consolePermission{}
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, consoleRoleListResponse{Items: items})
}

// ListConsoleRolePermissions returns the permission catalog for the role editor.
func (h *WindowsHandler) ListConsoleRolePermissions(c *gin.Context) {
	var permissions []consolePermission
	if err := db.DB.Table("permissions").
		Select("id, name").
		Order("id ASC").
		Scan(&permissions).Error; err != nil {
		log.Printf("[console-roles] permission catalog failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list permissions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"items": permissions})
}
