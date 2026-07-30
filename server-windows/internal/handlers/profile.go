package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/middleware"
)

// ConsoleProfile describes the operator behind the current request.
//
// The console needs its own platformScope to hide the ecosystem it cannot
// manage. Serving it here keeps that to one request: the Java
// /private/users/current payload has no scope columns, and the role list is not
// a safe substitute because it exposes every other role too.
type ConsoleProfile struct {
	UserID        uint   `json:"userId"`
	Login         string `json:"login"`
	RoleID        uint   `json:"roleId"`
	RoleName      string `json:"roleName"`
	SuperAdmin    bool   `json:"superAdmin"`
	PlatformScope string `json:"platformScope"`
	AccessLevel   string `json:"accessLevel"`
}

// GetConsoleProfile returns the identity that AdminAuth already resolved for
// this request, so the console can hide the ecosystem it cannot manage.
//
// The scope reported here is advisory for the UI. This service keeps enforcing
// it on every route of its own; the Android routes the Java server still owns do
// not check it yet.
func (h *WindowsHandler) GetConsoleProfile(c *gin.Context) {
	user, userOK := middleware.CurrentUser(c)
	role, roleOK := middleware.CurrentRole(c)
	if !userOK || !roleOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	c.JSON(http.StatusOK, ConsoleProfile{
		UserID:        user.ID,
		Login:         user.Login,
		RoleID:        role.ID,
		RoleName:      role.Name,
		SuperAdmin:    role.SuperAdmin,
		PlatformScope: role.VisibleScope(),
		AccessLevel:   role.EffectiveAccessLevel(),
	})
}
