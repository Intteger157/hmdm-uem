package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
)

func setupSSOSettingsFixture(t *testing.T) {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_handlers_sso_settings")
	if err := database.AutoMigrate(&models.SSOSettings{}); err != nil {
		t.Fatalf("migrate SSO settings: %v", err)
	}

	previous := db.DB
	db.DB = database
	t.Cleanup(func() { db.DB = previous })
}

func newSSOSettingsRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewWindowsHandler()
	router.GET("/rest/sso/settings", handler.GetSSOSettings)
	router.PUT("/rest/sso/settings", handler.UpdateSSOSettings)
	return router
}

func TestGetSSOSettingsCreatesDefaults(t *testing.T) {
	setupSSOSettingsFixture(t)
	router := newSSOSettingsRouter()

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/rest/sso/settings", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var body models.SSOSettingsResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Provider != models.SSOProviderEntra {
		t.Errorf("provider = %q, want %q", body.Provider, models.SSOProviderEntra)
	}
	if body.Enabled {
		t.Error("enabled = true, want false")
	}
}

func TestUpdateSSOSettingsPersistsValues(t *testing.T) {
	setupSSOSettingsFixture(t)
	router := newSSOSettingsRouter()

	payload := `{
		"provider":"entra",
		"enabled":true,
		"tenantId":"11111111-1111-1111-1111-111111111111",
		"clientId":"22222222-2222-2222-2222-222222222222",
		"clientSecret":"secret-value"
	}`

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/rest/sso/settings", strings.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("PUT status = %d, want %d, body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}

	getRecorder := httptest.NewRecorder()
	router.ServeHTTP(getRecorder, httptest.NewRequest(http.MethodGet, "/rest/sso/settings", nil))

	var body models.SSOSettingsResponse
	if err := json.Unmarshal(getRecorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode GET response: %v", err)
	}

	if !body.Enabled {
		t.Error("enabled = false, want true")
	}
	if body.TenantID != "11111111-1111-1111-1111-111111111111" {
		t.Errorf("tenantId = %q", body.TenantID)
	}
	if body.ClientSecret != "secret-value" {
		t.Errorf("clientSecret = %q", body.ClientSecret)
	}
}

func TestUpdateSSOSettingsRequiresSecretWhenEnabling(t *testing.T) {
	setupSSOSettingsFixture(t)
	router := newSSOSettingsRouter()

	payload := `{
		"enabled":true,
		"tenantId":"11111111-1111-1111-1111-111111111111",
		"clientId":"22222222-2222-2222-2222-222222222222",
		"clientSecret":""
	}`

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/rest/sso/settings", strings.NewReader(payload))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusBadRequest)
	}
}

func newPublicSSOStatusRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewWindowsHandler()
	router.GET("/rest/auth/sso-status", handler.GetPublicSSOStatus)
	return router
}

func TestGetPublicSSOStatusNeverExposesSecrets(t *testing.T) {
	setupSSOSettingsFixture(t)
	router := newSSOSettingsRouter()
	publicRouter := newPublicSSOStatusRouter()

	payload := `{
		"provider":"entra",
		"enabled":true,
		"tenantId":"11111111-1111-1111-1111-111111111111",
		"clientId":"22222222-2222-2222-2222-222222222222",
		"clientSecret":"super-secret-value"
	}`

	putRecorder := httptest.NewRecorder()
	putRequest := httptest.NewRequest(http.MethodPut, "/rest/sso/settings", strings.NewReader(payload))
	putRequest.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(putRecorder, putRequest)
	if putRecorder.Code != http.StatusOK {
		t.Fatalf("PUT status = %d, want %d", putRecorder.Code, http.StatusOK)
	}

	recorder := httptest.NewRecorder()
	publicRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/rest/auth/sso-status", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body=%s", recorder.Code, http.StatusOK, recorder.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(body) != 1 {
		t.Fatalf("response keys = %d, want 1: %v", len(body), body)
	}
	if body["entraEnabled"] != true {
		t.Fatalf("entraEnabled = %v, want true", body["entraEnabled"])
	}
	for _, forbidden := range []string{"tenantId", "clientId", "clientSecret", "provider", "enabled"} {
		if _, ok := body[forbidden]; ok {
			t.Fatalf("response must not include %q", forbidden)
		}
	}
}

func TestGetPublicSSOStatusDisabledByDefault(t *testing.T) {
	setupSSOSettingsFixture(t)
	publicRouter := newPublicSSOStatusRouter()

	recorder := httptest.NewRecorder()
	publicRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/rest/auth/sso-status", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var body models.SSOStatusResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.EntraEnabled {
		t.Fatal("entraEnabled = true, want false")
	}
}
