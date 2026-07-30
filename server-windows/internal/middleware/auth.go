package middleware

import (
	"errors"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

// Context keys holding the resolved console identity for downstream handlers.
const (
	ContextUserKey = "rbac.user"
	ContextRoleKey = "rbac.role"
)

var (
	errUserNotFound   = errors.New("console user not found")
	errUserHasNoRole  = errors.New("console user has no role assigned")
	errStaleAuthToken = errors.New("token was invalidated by a newer sign-in")
)

// AdminAuth authenticates console operators against the JWT issued by the Java
// server and enforces their role's platform scope.
//
// It is fail-closed: a request without a verifiable token is rejected with 401,
// and a verified operator whose role is scoped to another ecosystem is rejected
// with 403. Agent routes must not use this middleware — agents carry an
// enrollment-issued token, not a console JWT.
func AdminAuth(secret string) gin.HandlerFunc {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		log.Printf("[auth] JWT_SECRET is not set — every admin API request will be rejected with 503; set it to the same value as the Java server's jwt.secretkey")
	}

	return func(c *gin.Context) {
		if secret == "" || db.DB == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "admin authentication is not configured",
			})
			return
		}

		claims, err := parseAdminToken(extractToken(c), secret)
		if err != nil {
			abortUnauthorized(c, err)
			return
		}

		if !authorizeClaims(c, claims) {
			return
		}

		c.Next()
	}
}

// AdminOrAgent guards the routes that both the console and the Windows agent
// call, such as effective-config. A console JWT is verified and scope-checked as
// usual; any other bearer token is left to the handler's own agent check, which
// is the pre-existing behaviour for those endpoints.
func AdminOrAgent(secret string) gin.HandlerFunc {
	secret = strings.TrimSpace(secret)

	return func(c *gin.Context) {
		raw := extractToken(c)
		if raw == "" {
			abortUnauthorized(c, ErrMissingToken)
			return
		}

		claims, err := parseAdminToken(raw, secret)
		if err != nil {
			c.Next()
			return
		}

		if !authorizeClaims(c, claims) {
			return
		}

		c.Next()
	}
}

// authorizeClaims resolves the operator behind a verified token and applies the
// platform scope rule. It reports whether the request may continue, and has
// already written the response when it returns false.
func authorizeClaims(c *gin.Context, claims *adminClaims) bool {
	user, role, err := resolveConsoleIdentity(claims)
	if err != nil {
		abortUnauthorized(c, err)
		return false
	}

	platform := PlatformForPath(c.Request.URL.Path)
	if !role.AllowsPlatform(platform) {
		log.Printf("[auth] denied login=%q role=%q scope=%s platform=%s path=%q",
			user.Login, role.Name, role.EffectivePlatformScope(), platform, c.Request.URL.Path)
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"error": "role is not permitted to manage " + platform + " devices",
		})
		return false
	}

	c.Set(ContextUserKey, user)
	c.Set(ContextRoleKey, role)
	return true
}

// extractToken reads the console JWT from the Authorization header, falling back
// to the "token" query parameter used by the WebSocket relays — browsers cannot
// set headers on a WebSocket handshake.
func extractToken(c *gin.Context) string {
	header := strings.TrimSpace(c.GetHeader("Authorization"))
	if after, found := strings.CutPrefix(header, "Bearer "); found {
		return strings.TrimSpace(after)
	}

	return strings.TrimSpace(c.Query("token"))
}

// resolveConsoleIdentity loads the caller and their role from the tables owned by
// the Java server, and rejects tokens superseded by a newer sign-in the same way
// the Java JWTFilter does.
func resolveConsoleIdentity(claims *adminClaims) (models.User, models.UserRole, error) {
	var user models.User
	login := strings.TrimSpace(claims.Subject)
	if login == "" {
		return user, models.UserRole{}, errUserNotFound
	}

	err := db.DB.Where("LOWER(login) = LOWER(?)", login).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return user, models.UserRole{}, errUserNotFound
	}
	if err != nil {
		return user, models.UserRole{}, err
	}

	// Match Java JWTFilter: the rotating authToken claim is optional in the sense
	// that an absent claim must not be treated as stale when the DB row has one.
	if claims.AuthToken != "" && user.AuthToken != nil && *user.AuthToken != "" && *user.AuthToken != claims.AuthToken {
		return user, models.UserRole{}, errStaleAuthToken
	}

	if user.UserRoleID == nil {
		return user, models.UserRole{}, errUserHasNoRole
	}

	var role models.UserRole
	if err := db.DB.First(&role, *user.UserRoleID).Error; err != nil {
		return user, role, err
	}

	return user, role, nil
}

func abortUnauthorized(c *gin.Context, err error) {
	log.Printf("[auth] rejected %s %s: %v", c.Request.Method, c.Request.URL.Path, err)
	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
}

// CurrentUser returns the console operator resolved by AdminAuth.
func CurrentUser(c *gin.Context) (models.User, bool) {
	value, exists := c.Get(ContextUserKey)
	if !exists {
		return models.User{}, false
	}
	user, ok := value.(models.User)
	return user, ok
}

// CurrentRole returns the role of the console operator resolved by AdminAuth.
func CurrentRole(c *gin.Context) (models.UserRole, bool) {
	value, exists := c.Get(ContextRoleKey)
	if !exists {
		return models.UserRole{}, false
	}
	role, ok := value.(models.UserRole)
	return role, ok
}
