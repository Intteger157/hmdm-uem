package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
)

// consoleFixtureDDL builds a miniature copy of the Java console schema with one
// user per platform scope.
const consoleFixtureDDL = `
DROP TABLE IF EXISTS users, userroles CASCADE;

CREATE TABLE userRoles (
	id serial NOT NULL PRIMARY KEY,
	name varchar(50) NOT NULL,
	description TEXT,
	superadmin BOOLEAN NOT NULL DEFAULT false,
	platform_scope varchar(16) NOT NULL DEFAULT 'global',
	access_level varchar(16) NOT NULL DEFAULT 'high'
);

CREATE TABLE users (
	id serial NOT NULL PRIMARY KEY,
	login varchar(30) NOT NULL UNIQUE,
	email varchar(50),
	name varchar(50),
	password varchar(32) NOT NULL,
	userRoleId INT REFERENCES userRoles( id ),
	authToken varchar(40)
);

INSERT INTO userRoles (id, name, superadmin, platform_scope, access_level) VALUES
	(1, 'Global Administrator', false, 'global', 'high'),
	(2, 'Windows Engineer',     false, 'windows', 'high'),
	(3, 'Android Engineer',     false, 'android', 'high'),
	(4, 'Legacy Super-Admin',   true,  'android', 'high');

INSERT INTO users (login, password, userRoleId, authToken) VALUES
	('global.admin',  'x', 1, 'auth-global'),
	('win.engineer',  'x', 2, 'auth-win'),
	('droid.engineer','x', 3, 'auth-droid'),
	('super.admin',   'x', 4, 'auth-super'),
	('roleless',      'x', NULL, 'auth-roleless');
`

const testSecret = "20c68f0d9185b1d18cf6add1e8b491fd89529a44"

func setupConsoleFixture(t *testing.T) {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_middleware_auth")
	if err := database.Exec(consoleFixtureDDL).Error; err != nil {
		t.Fatalf("install console fixture: %v", err)
	}

	previous := db.DB
	db.DB = database
	t.Cleanup(func() { db.DB = previous })
}

func mintToken(t *testing.T, login, authToken string) string {
	t.Helper()

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS512, jwt.MapClaims{
		"sub":   login,
		"token": authToken,
		"exp":   time.Now().Add(time.Hour).Unix(),
	}).SignedString([]byte(testSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func newGuardedRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(AdminAuth(testSecret))
	router.GET("/rest/windows/devices", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.GET("/rest/android/devices", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	router.GET("/api/taskmgr/admin", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return router
}

func TestAdminAuthEnforcesPlatformScope(t *testing.T) {
	setupConsoleFixture(t)
	router := newGuardedRouter()

	tests := []struct {
		name       string
		path       string
		login      string
		authToken  string
		wantStatus int
	}{
		{"windows engineer reaches windows API", "/rest/windows/devices", "win.engineer", "auth-win", http.StatusOK},
		{"global admin reaches windows API", "/rest/windows/devices", "global.admin", "auth-global", http.StatusOK},
		{"android engineer blocked from windows API", "/rest/windows/devices", "droid.engineer", "auth-droid", http.StatusForbidden},
		{"android engineer reaches android API", "/rest/android/devices", "droid.engineer", "auth-droid", http.StatusOK},
		{"windows engineer blocked from android API", "/rest/android/devices", "win.engineer", "auth-win", http.StatusForbidden},
		{"android engineer blocked from windows relay", "/api/taskmgr/admin", "droid.engineer", "auth-droid", http.StatusForbidden},
		{"superadmin bypasses scope", "/rest/windows/devices", "super.admin", "auth-super", http.StatusOK},
		{"user without a role is rejected", "/rest/windows/devices", "roleless", "auth-roleless", http.StatusUnauthorized},
		{"unknown login is rejected", "/rest/windows/devices", "ghost", "auth-ghost", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, tt.path, nil)
			request.Header.Set("Authorization", "Bearer "+mintToken(t, tt.login, tt.authToken))

			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
		})
	}
}

func TestAdminAuthRejectsMissingAndForgedTokens(t *testing.T) {
	setupConsoleFixture(t)
	router := newGuardedRouter()

	tests := []struct {
		name   string
		header string
	}{
		{"no authorization header", ""},
		{"empty bearer", "Bearer "},
		{"opaque agent token", "Bearer mock-jwt-token-777"},
		{"malformed jwt", "Bearer not.a.jwt"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/rest/windows/devices", nil)
			if tt.header != "" {
				request.Header.Set("Authorization", tt.header)
			}

			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
			}
		})
	}
}

func TestAdminAuthRejectsSupersededToken(t *testing.T) {
	setupConsoleFixture(t)
	router := newGuardedRouter()

	// Signing in again rotates users.authToken, which must invalidate the old JWT
	// exactly as the Java JWTFilter does.
	err := db.DB.Model(&models.User{}).
		Where("login = ?", "win.engineer").
		Update("authtoken", "auth-win-rotated").Error
	if err != nil {
		t.Fatalf("rotate auth token: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/rest/windows/devices", nil)
	request.Header.Set("Authorization", "Bearer "+mintToken(t, "win.engineer", "auth-win"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}
}

func TestAdminAuthAcceptsWebSocketQueryToken(t *testing.T) {
	setupConsoleFixture(t)
	router := newGuardedRouter()

	// Browsers cannot set headers on a WebSocket handshake, so the relays pass
	// the JWT as ?token=.
	target := "/api/taskmgr/admin?deviceID=abc123&token=" + mintToken(t, "win.engineer", "auth-win")

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, target, nil))

	if recorder.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestAdminAuthIsUnavailableWithoutSecret(t *testing.T) {
	setupConsoleFixture(t)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(AdminAuth(""))
	router.GET("/rest/windows/devices", func(c *gin.Context) { c.Status(http.StatusOK) })

	request := httptest.NewRequest(http.MethodGet, "/rest/windows/devices", nil)
	request.Header.Set("Authorization", "Bearer "+mintToken(t, "global.admin", "auth-global"))

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusServiceUnavailable)
	}
}

func TestAdminOrAgentAcceptsBothCredentials(t *testing.T) {
	setupConsoleFixture(t)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(AdminOrAgent(testSecret))
	router.GET("/rest/windows/devices/:hardwareId/effective-config", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	const path = "/rest/windows/devices/abc123/effective-config"

	tests := []struct {
		name       string
		header     string
		wantStatus int
	}{
		{"agent bearer token", "Bearer mock-jwt-token-777", http.StatusOK},
		{"windows console jwt", "Bearer " + mintToken(t, "win.engineer", "auth-win"), http.StatusOK},
		{"android console jwt", "Bearer " + mintToken(t, "droid.engineer", "auth-droid"), http.StatusForbidden},
		{"no credentials", "", http.StatusUnauthorized},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, path, nil)
			if tt.header != "" {
				request.Header.Set("Authorization", tt.header)
			}

			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", recorder.Code, tt.wantStatus)
			}
		})
	}
}
