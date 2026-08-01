package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
)

const oauthConsoleFixtureDDL = `
DROP TABLE IF EXISTS users, sso_settings, userroles CASCADE;

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
	(1, 'Global Administrator', false, 'global', 'high');

INSERT INTO users (login, email, password, userRoleId, authToken) VALUES
	('sso.user', 'operator@example.com', 'x', 1, 'auth-sso-user');
`

func setupOAuthFixture(t *testing.T) {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_handlers_oauth_microsoft")
	if err := database.Exec(oauthConsoleFixtureDDL).Error; err != nil {
		t.Fatalf("install oauth fixture: %v", err)
	}
	if err := database.AutoMigrate(&models.SSOSettings{}); err != nil {
		t.Fatalf("migrate sso settings: %v", err)
	}

	settings := models.SSOSettings{
		ID:           1,
		Provider:     models.SSOProviderEntra,
		Enabled:      true,
		TenantID:     "tenant-id",
		ClientID:     "client-id",
		ClientSecret: "client-secret",
	}
	if err := database.Create(&settings).Error; err != nil {
		t.Fatalf("seed sso settings: %v", err)
	}

	previous := db.DB
	db.DB = database
	t.Cleanup(func() { db.DB = previous })
}

func TestStartMicrosoftOAuthRedirectsWhenEnabled(t *testing.T) {
	setupOAuthFixture(t)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/api/auth/login/microsoft", handler.StartMicrosoftOAuth)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/login/microsoft", nil)
	request.Host = "mdm.example.com"
	request.Header.Set("X-Forwarded-Proto", "https")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d, body=%s", recorder.Code, http.StatusFound, recorder.Body.String())
	}

	location := recorder.Header().Get("Location")
	if !strings.Contains(location, "login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize") {
		t.Fatalf("location = %q", location)
	}
	if !strings.Contains(location, "client_id=client-id") {
		t.Fatalf("location missing client_id: %q", location)
	}
	if !strings.Contains(location, "redirect_uri=") {
		t.Fatalf("location missing redirect_uri: %q", location)
	}
	if recorder.Header().Get("Set-Cookie") == "" {
		t.Fatal("expected oauth state cookie")
	}
}

func TestStartMicrosoftOAuthForbiddenWhenDisabled(t *testing.T) {
	setupOAuthFixture(t)
	if err := db.DB.Model(&models.SSOSettings{}).Where("id = ?", 1).Update("enabled", false).Error; err != nil {
		t.Fatalf("disable sso: %v", err)
	}

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/api/auth/login/microsoft", handler.StartMicrosoftOAuth)

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/auth/login/microsoft", nil))

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusForbidden)
	}
}

func TestMicrosoftOAuthCallbackRejectsInvalidState(t *testing.T) {
	setupOAuthFixture(t)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/api/auth/callback/microsoft", handler.MicrosoftOAuthCallback)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/auth/callback/microsoft?code=abc&state=wrong", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusFound)
	}
	if !strings.Contains(recorder.Header().Get("Location"), "error=invalid_state") {
		t.Fatalf("location = %q", recorder.Header().Get("Location"))
	}
}

func TestFindConsoleUserByEmailOrLogin(t *testing.T) {
	setupOAuthFixture(t)

	user, err := findConsoleUserByEmailOrLogin("operator@example.com")
	if err != nil {
		t.Fatalf("findConsoleUserByEmailOrLogin() error = %v", err)
	}
	if user.Login != "sso.user" {
		t.Fatalf("login = %q, want sso.user", user.Login)
	}
}

func TestFindConsoleUserByEmailOrLoginNotFound(t *testing.T) {
	setupOAuthFixture(t)

	_, err := findConsoleUserByEmailOrLogin("missing@example.com")
	if err == nil {
		t.Fatal("expected error for missing user")
	}
}

func TestEnsureConsoleAuthTokenGeneratesWhenMissing(t *testing.T) {
	setupOAuthFixture(t)

	var user models.User
	if err := db.DB.Where("login = ?", "sso.user").First(&user).Error; err != nil {
		t.Fatalf("load user: %v", err)
	}
	user.AuthToken = nil

	token, err := ensureConsoleAuthToken(&user)
	if err != nil {
		t.Fatalf("ensureConsoleAuthToken() error = %v", err)
	}
	if len(token) != 40 {
		t.Fatalf("token length = %d, want 40", len(token))
	}

	var stored models.User
	if err := db.DB.Where("login = ?", "sso.user").First(&stored).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if stored.AuthToken == nil || *stored.AuthToken != token {
		t.Fatalf("stored auth token = %v, want %q", stored.AuthToken, token)
	}
}

func TestMicrosoftOAuthCallbackRedirectsProviderErrorWithoutNetwork(t *testing.T) {
	setupOAuthFixture(t)

	handler := NewWindowsHandler()
	router := gin.New()
	router.GET("/api/auth/callback/microsoft", handler.MicrosoftOAuthCallback)

	state := "fixed-state"
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodGet,
		"/api/auth/callback/microsoft?code=oauth-code&state="+url.QueryEscape(state),
		nil,
	)
	request.AddCookie(&http.Cookie{Name: "sso_oauth_state", Value: state})
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusFound)
	}
	if !strings.Contains(recorder.Header().Get("Location"), "error=provider_error") &&
		!strings.Contains(recorder.Header().Get("Location"), "error=user_not_found") {
		t.Fatalf("location = %q", recorder.Header().Get("Location"))
	}
}
