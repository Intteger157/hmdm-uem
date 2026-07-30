package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/middleware"
	"github.com/hmdm/server-windows/internal/models"
)

// newProfileRouter stands in for AdminAuth by seeding the same context keys the
// middleware sets once it has verified the JWT.
func newProfileRouter(identity func(*gin.Context)) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if identity != nil {
		router.Use(identity)
	}
	router.GET("/rest/windows/me", NewWindowsHandler().GetConsoleProfile)
	return router
}

func getProfile(t *testing.T, router *gin.Engine) (*httptest.ResponseRecorder, ConsoleProfile) {
	t.Helper()

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/rest/windows/me", nil))

	var profile ConsoleProfile
	if recorder.Code == http.StatusOK {
		if err := json.Unmarshal(recorder.Body.Bytes(), &profile); err != nil {
			t.Fatalf("decode response: %v", err)
		}
	}
	return recorder, profile
}

func TestGetConsoleProfileReturnsResolvedIdentity(t *testing.T) {
	name := "Windows Engineer"
	router := newProfileRouter(func(c *gin.Context) {
		c.Set(middleware.ContextUserKey, models.User{ID: 7, Login: "win.engineer", Name: &name})
		c.Set(middleware.ContextRoleKey, models.UserRole{
			ID:            2,
			Name:          name,
			PlatformScope: models.PlatformScopeWindows,
			AccessLevel:   models.AccessLevelMid,
		})
	})

	recorder, profile := getProfile(t, router)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
	}

	want := ConsoleProfile{
		UserID:        7,
		Login:         "win.engineer",
		RoleID:        2,
		RoleName:      name,
		PlatformScope: models.PlatformScopeWindows,
		AccessLevel:   models.AccessLevelMid,
	}
	if profile != want {
		t.Errorf("profile = %+v, want %+v", profile, want)
	}
}

func TestGetConsoleProfileWidensSuperAdminScope(t *testing.T) {
	// A super admin passes every platform check server-side, so reporting the
	// stored scope would hide navigation they are allowed to use.
	router := newProfileRouter(func(c *gin.Context) {
		c.Set(middleware.ContextUserKey, models.User{ID: 1, Login: "super.admin"})
		c.Set(middleware.ContextRoleKey, models.UserRole{
			ID:            4,
			Name:          "Legacy Super-Admin",
			SuperAdmin:    true,
			PlatformScope: models.PlatformScopeAndroid,
		})
	})

	_, profile := getProfile(t, router)

	if profile.PlatformScope != models.PlatformScopeGlobal {
		t.Errorf("PlatformScope = %q, want %q", profile.PlatformScope, models.PlatformScopeGlobal)
	}
	if !profile.SuperAdmin {
		t.Error("SuperAdmin = false, want true")
	}
}

func TestGetConsoleProfileDefaultsLegacyRole(t *testing.T) {
	// Roles predating the matrix columns were unrestricted; blank values must
	// read as global/high rather than locking the console down.
	router := newProfileRouter(func(c *gin.Context) {
		c.Set(middleware.ContextUserKey, models.User{ID: 3, Login: "legacy"})
		c.Set(middleware.ContextRoleKey, models.UserRole{ID: 9, Name: "Legacy"})
	})

	_, profile := getProfile(t, router)

	if profile.PlatformScope != models.PlatformScopeGlobal {
		t.Errorf("PlatformScope = %q, want %q", profile.PlatformScope, models.PlatformScopeGlobal)
	}
	if profile.AccessLevel != models.AccessLevelHigh {
		t.Errorf("AccessLevel = %q, want %q", profile.AccessLevel, models.AccessLevelHigh)
	}
}

func TestGetConsoleProfileRequiresResolvedIdentity(t *testing.T) {
	// Reached only if the route is ever mounted without AdminAuth; fail closed
	// instead of reporting an empty, unscoped profile.
	recorder, _ := getProfile(t, newProfileRouter(nil))

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}
