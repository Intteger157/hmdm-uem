package handlers

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/auth"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/middleware"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

type consoleUserRoleRef struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	SuperAdmin bool   `json:"superAdmin,omitempty"`
}

type consoleUserItem struct {
	ID                  uint               `json:"id"`
	Login               string             `json:"login"`
	Name                string             `json:"name,omitempty"`
	Email               string             `json:"email,omitempty"`
	AllDevicesAvailable bool               `json:"allDevicesAvailable"`
	AllConfigAvailable  bool               `json:"allConfigAvailable"`
	UserRole            consoleUserRoleRef `json:"userRole"`
}

type consoleUserListResponse struct {
	Items []consoleUserItem `json:"items"`
}

type consoleUserRoleOption struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	SuperAdmin bool   `json:"superAdmin,omitempty"`
}

type upsertConsoleUserRequest struct {
	ID                  *uint              `json:"id"`
	Login               string             `json:"login"`
	Name                string             `json:"name"`
	Email               string             `json:"email"`
	NewPassword         string             `json:"newPassword"`
	AllDevicesAvailable *bool              `json:"allDevicesAvailable"`
	AllConfigAvailable  *bool              `json:"allConfigAvailable"`
	UserRole            consoleUserRoleRef `json:"userRole"`
}

type userWithRoleRow struct {
	models.User
	RoleID        *uint   `gorm:"column:role_id"`
	RoleName      *string `gorm:"column:role_name"`
	RoleSuperAdmin *bool  `gorm:"column:role_superadmin"`
}

func toConsoleUserItem(row userWithRoleRow) consoleUserItem {
	item := consoleUserItem{
		ID:                  row.ID,
		Login:               row.Login,
		AllDevicesAvailable: row.AllDevicesAvailable,
		AllConfigAvailable:  row.AllConfigAvailable,
	}
	if row.Name != nil {
		item.Name = strings.TrimSpace(*row.Name)
	}
	if row.Email != nil {
		item.Email = strings.TrimSpace(*row.Email)
	}
	if row.RoleID != nil && row.RoleName != nil {
		item.UserRole = consoleUserRoleRef{
			ID:         *row.RoleID,
			Name:       strings.TrimSpace(*row.RoleName),
			SuperAdmin: row.RoleSuperAdmin != nil && *row.RoleSuperAdmin,
		}
	}
	return item
}

func listUsersWithRoles() ([]consoleUserItem, error) {
	var rows []userWithRoleRow
	err := db.DB.Table("users u").
		Select(`u.id, u.login, u.name, u.email, u.password, u.customerid, u.userroleid,
			u.alldevicesavailable, u.allconfigavailable, u.authtoken,
			r.id AS role_id, r.name AS role_name, r.superadmin AS role_superadmin`).
		Joins("LEFT JOIN userroles r ON r.id = u.userroleid").
		Order("LOWER(u.login) ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	items := make([]consoleUserItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, toConsoleUserItem(row))
	}
	return items, nil
}

// ListConsoleUsers returns every console account for the Users screen.
func (h *WindowsHandler) ListConsoleUsers(c *gin.Context) {
	items, err := listUsersWithRoles()
	if err != nil {
		log.Printf("[console-users] list failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list users"})
		return
	}

	c.JSON(http.StatusOK, consoleUserListResponse{Items: items})
}

// ListConsoleUserRoles returns assignable roles for the user editor dropdown.
func (h *WindowsHandler) ListConsoleUserRoles(c *gin.Context) {
	var roles []models.UserRole
	if err := db.DB.Order("LOWER(name) ASC").Find(&roles).Error; err != nil {
		log.Printf("[console-users] list roles failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list roles"})
		return
	}

	items := make([]consoleUserRoleOption, 0, len(roles))
	for _, role := range roles {
		items = append(items, consoleUserRoleOption{
			ID:         role.ID,
			Name:       role.Name,
			SuperAdmin: role.SuperAdmin,
		})
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

// UpsertConsoleUser creates or updates a console account.
func (h *WindowsHandler) UpsertConsoleUser(c *gin.Context) {
	var req upsertConsoleUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	login := strings.TrimSpace(req.Login)
	if login == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "login is required"})
		return
	}
	if req.UserRole.ID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userRole is required"})
		return
	}

	var role models.UserRole
	if err := db.DB.First(&role, req.UserRole.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role not found"})
			return
		}
		log.Printf("[console-users] lookup role id=%d failed: %v", req.UserRole.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup role"})
		return
	}

	email := strings.TrimSpace(req.Email)
	if email != "" {
		var existing models.User
		query := db.DB.Where("LOWER(email) = LOWER(?)", email)
		if req.ID != nil {
			query = query.Where("id <> ?", *req.ID)
		}
		if err := query.First(&existing).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate email"})
			return
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			log.Printf("[console-users] email lookup failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate email"})
			return
		}
	}

	var duplicate models.User
	dupQuery := db.DB.Where("LOWER(login) = LOWER(?)", login)
	if req.ID != nil {
		dupQuery = dupQuery.Where("id <> ?", *req.ID)
	}
	if err := dupQuery.First(&duplicate).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "duplicate login"})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("[console-users] login lookup failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to validate login"})
		return
	}

	caller, callerOK := middleware.CurrentUser(c)
	if !callerOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	name := strings.TrimSpace(req.Name)
	roleID := role.ID

	if req.ID == nil {
		newPassword := strings.TrimSpace(req.NewPassword)
		if newPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "password is required"})
			return
		}

		authToken, err := auth.GenerateAuthToken()
		if err != nil {
			log.Printf("[console-users] generate auth token failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		user := models.User{
			Login:               login,
			Password:            auth.HashPasswordFromMD5(newPassword),
			CustomerID:          defaultCustomerID(caller),
			UserRoleID:          &roleID,
			AllDevicesAvailable: true,
			AllConfigAvailable:  true,
			AuthToken:           &authToken,
		}
		if name != "" {
			user.Name = &name
		}
		if email != "" {
			user.Email = &email
		}
		if req.AllDevicesAvailable != nil {
			user.AllDevicesAvailable = *req.AllDevicesAvailable
		}
		if req.AllConfigAvailable != nil {
			user.AllConfigAvailable = *req.AllConfigAvailable
		}

		if err := db.DB.Create(&user).Error; err != nil {
			log.Printf("[console-users] create login=%q failed: %v", login, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create user"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "OK"})
		return
	}

	var user models.User
	if err := db.DB.First(&user, *req.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		log.Printf("[console-users] lookup id=%d failed: %v", *req.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to lookup user"})
		return
	}

	updates := map[string]any{
		"login":      login,
		"userroleid": roleID,
	}
	if name != "" {
		updates["name"] = name
	} else {
		updates["name"] = nil
	}
	if email != "" {
		updates["email"] = email
	} else {
		updates["email"] = nil
	}
	if req.AllDevicesAvailable != nil {
		updates["alldevicesavailable"] = *req.AllDevicesAvailable
	}
	if req.AllConfigAvailable != nil {
		updates["allconfigavailable"] = *req.AllConfigAvailable
	}

	newPassword := strings.TrimSpace(req.NewPassword)
	if newPassword != "" {
		updates["password"] = auth.HashPasswordFromMD5(newPassword)
		authToken, err := auth.GenerateAuthToken()
		if err != nil {
			log.Printf("[console-users] rotate auth token failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
			return
		}
		updates["authtoken"] = authToken
	}

	if err := db.DB.Model(&models.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		log.Printf("[console-users] update id=%d failed: %v", user.ID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "OK"})
}

// DeleteConsoleUser removes another console account.
func (h *WindowsHandler) DeleteConsoleUser(c *gin.Context) {
	userID, ok := parseUintParam(c.Param("userId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	caller, callerOK := middleware.CurrentUser(c)
	if !callerOK {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	if caller.ID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot delete the signed-in account"})
		return
	}

	result := db.DB.Delete(&models.User{}, userID)
	if result.Error != nil {
		log.Printf("[console-users] delete id=%d failed: %v", userID, result.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete user"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "OK"})
}

func defaultCustomerID(caller models.User) int {
	if caller.CustomerID > 0 {
		return caller.CustomerID
	}
	return 1
}
