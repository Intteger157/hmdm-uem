package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// RoleMatrixItem exposes the RBAC matrix of one console role. Name and
// superAdmin are read-only here: the Java console still owns them, along with
// descriptions and the legacy permission checkboxes.
type RoleMatrixItem struct {
	ID            uint   `json:"id"`
	Name          string `json:"name"`
	SuperAdmin    bool   `json:"superAdmin"`
	PlatformScope string `json:"platformScope"`
	AccessLevel   string `json:"accessLevel"`
}

// RoleMatrixListResponse is the payload of GET /rest/windows/roles.
type RoleMatrixListResponse struct {
	Items []RoleMatrixItem `json:"items"`
}

// UpdateRoleMatrixRequest is the payload of PUT /rest/windows/roles/:roleId.
type UpdateRoleMatrixRequest struct {
	PlatformScope string `json:"platformScope"`
	AccessLevel   string `json:"accessLevel"`
}

func toRoleMatrixItem(role models.UserRole) RoleMatrixItem {
	return RoleMatrixItem{
		ID:            role.ID,
		Name:          role.Name,
		SuperAdmin:    role.SuperAdmin,
		PlatformScope: role.EffectivePlatformScope(),
		AccessLevel:   role.EffectiveAccessLevel(),
	}
}

// ListRoleMatrix returns the platform scope and access level of every console
// role, including the roles the Java list endpoint hides, so the UI can resolve
// a freshly created role by name.
func (h *WindowsHandler) ListRoleMatrix(c *gin.Context) {
	var roles []models.UserRole
	if err := db.DB.Order("id ASC").Find(&roles).Error; err != nil {
		log.Printf("[roles] list failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list roles"})
		return
	}

	items := make([]RoleMatrixItem, 0, len(roles))
	for _, role := range roles {
		items = append(items, toRoleMatrixItem(role))
	}

	c.JSON(http.StatusOK, RoleMatrixListResponse{Items: items})
}

// UpdateRoleMatrix persists the scope and level chosen in the Roles dialog. Only
// those two columns are written, so a concurrent edit in the Java console cannot
// be clobbered.
func (h *WindowsHandler) UpdateRoleMatrix(c *gin.Context) {
	roleID, ok := parseUintParam(c.Param("roleId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role id"})
		return
	}

	var req UpdateRoleMatrixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scope, scopeValid := models.NormalizePlatformScope(req.PlatformScope)
	if !scopeValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "platformScope must be one of global, windows, android"})
		return
	}

	level, levelValid := models.NormalizeAccessLevel(req.AccessLevel)
	if !levelValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accessLevel must be one of high, mid, low"})
		return
	}

	var role models.UserRole
	if err := db.DB.First(&role, roleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "role not found"})
			return
		}
		log.Printf("[roles] lookup id=%d failed: %v", roleID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup role"})
		return
	}

	updates := map[string]any{"platform_scope": scope, "access_level": level}
	if err := db.DB.Model(&models.UserRole{}).Where("id = ?", role.ID).Updates(updates).Error; err != nil {
		log.Printf("[roles] update id=%d failed: %v", role.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update role"})
		return
	}

	role.PlatformScope = scope
	role.AccessLevel = level
	c.JSON(http.StatusOK, toRoleMatrixItem(role))
}
