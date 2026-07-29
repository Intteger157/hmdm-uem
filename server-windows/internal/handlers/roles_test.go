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

const roleFixtureDDL = `
DROP TABLE IF EXISTS userroles CASCADE;

CREATE TABLE userRoles (
	id serial NOT NULL PRIMARY KEY,
	name varchar(50) NOT NULL,
	description TEXT,
	superadmin BOOLEAN NOT NULL DEFAULT false,
	platform_scope varchar(16) NOT NULL DEFAULT 'global',
	access_level varchar(16) NOT NULL DEFAULT 'high'
);

INSERT INTO userRoles (id, name, description, superadmin, platform_scope, access_level) VALUES
	(1, 'Super-Admin',      'Legacy',  true,  'global',  'high'),
	(2, 'Windows Operator', 'Seeded',  false, 'windows', 'mid'),
	(3, 'Android Observer', 'Seeded',  false, 'android', 'low');
`

func setupRoleFixture(t *testing.T) {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_handlers_roles")
	if err := database.Exec(roleFixtureDDL).Error; err != nil {
		t.Fatalf("install role fixture: %v", err)
	}

	previous := db.DB
	db.DB = database
	t.Cleanup(func() { db.DB = previous })
}

func newRoleRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewWindowsHandler()
	router.GET("/rest/windows/roles", handler.ListRoleMatrix)
	router.PUT("/rest/windows/roles/:roleId", handler.UpdateRoleMatrix)
	return router
}

func TestListRoleMatrix(t *testing.T) {
	setupRoleFixture(t)
	router := newRoleRouter()

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/rest/windows/roles", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	var body RoleMatrixListResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(body.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(body.Items))
	}

	// Super-admin roles are hidden by the Java list endpoint but must appear here
	// so the UI can resolve any role by id or name.
	if body.Items[0].Name != "Super-Admin" || !body.Items[0].SuperAdmin {
		t.Errorf("first item = %+v, want the super-admin role", body.Items[0])
	}
	if body.Items[1].PlatformScope != models.PlatformScopeWindows || body.Items[1].AccessLevel != models.AccessLevelMid {
		t.Errorf("second item = %+v, want windows/mid", body.Items[1])
	}
}

func TestUpdateRoleMatrix(t *testing.T) {
	setupRoleFixture(t)
	router := newRoleRouter()

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPut, "/rest/windows/roles/3",
		strings.NewReader(`{"platformScope":"WINDOWS","accessLevel":" high "}`))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
	}

	var updated RoleMatrixItem
	if err := json.Unmarshal(recorder.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if updated.PlatformScope != models.PlatformScopeWindows || updated.AccessLevel != models.AccessLevelHigh {
		t.Errorf("response = %+v, want windows/high", updated)
	}

	var stored models.UserRole
	if err := db.DB.First(&stored, 3).Error; err != nil {
		t.Fatalf("reload role: %v", err)
	}
	if stored.PlatformScope != models.PlatformScopeWindows || stored.AccessLevel != models.AccessLevelHigh {
		t.Errorf("stored = (%s, %s), want (windows, high)", stored.PlatformScope, stored.AccessLevel)
	}
	if stored.Name != "Android Observer" {
		t.Errorf("Name = %q: the update touched columns owned by the Java console", stored.Name)
	}
	if stored.Description == nil || *stored.Description != "Seeded" {
		t.Error("Description was modified by the matrix update")
	}
}

func TestUpdateRoleMatrixRejectsBadInput(t *testing.T) {
	setupRoleFixture(t)
	router := newRoleRouter()

	tests := []struct {
		name       string
		path       string
		body       string
		wantStatus int
	}{
		{"unknown scope", "/rest/windows/roles/2", `{"platformScope":"linux","accessLevel":"high"}`, http.StatusBadRequest},
		{"unknown level", "/rest/windows/roles/2", `{"platformScope":"windows","accessLevel":"root"}`, http.StatusBadRequest},
		{"empty payload", "/rest/windows/roles/2", `{}`, http.StatusBadRequest},
		{"non-numeric id", "/rest/windows/roles/abc", `{"platformScope":"windows","accessLevel":"high"}`, http.StatusBadRequest},
		{"missing role", "/rest/windows/roles/999", `{"platformScope":"windows","accessLevel":"high"}`, http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPut, tt.path, strings.NewReader(tt.body))
			request.Header.Set("Content-Type", "application/json")

			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d (body: %s)", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
		})
	}
}
