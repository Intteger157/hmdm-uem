package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/auth"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
)

func setupDeviceAuthFixture(t *testing.T) models.WindowsDevice {
	t.Helper()

	database := testsupport.OpenSchema(t, "it_middleware_device_auth")
	if err := database.AutoMigrate(&models.WindowsDevice{}); err != nil {
		t.Fatalf("migrate windows_devices: %v", err)
	}

	device := models.WindowsDevice{HardwareID: "hw-migration-test"}
	if err := database.Create(&device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}

	previous := db.DB
	db.DB = database
	t.Cleanup(func() { db.DB = previous })

	return device
}

func TestAuthenticateDeviceRequestAcceptsLegacyGraceToken(t *testing.T) {
	setupDeviceAuthFixture(t)

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/rest/windows/checkin", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+auth.LegacyAgentToken)
	ctx.Request.Header.Set("X-Device-Id", "hw-migration-test")

	if !AuthenticateDeviceRequest(ctx) {
		t.Fatalf("expected legacy token to be accepted during grace period")
	}
	if recorder.Code != 0 && recorder.Code != http.StatusOK {
		t.Fatalf("unexpected abort status = %d body=%s", recorder.Code, recorder.Body.String())
	}
}

func TestAuthenticateDeviceRequestRejectsUnknownTokenAfterMigration(t *testing.T) {
	device := setupDeviceAuthFixture(t)

	raw, hash, err := auth.GenerateAgentToken()
	if err != nil {
		t.Fatalf("GenerateAgentToken() error = %v", err)
	}
	if err := db.DB.Model(&device).Update("agent_token_hash", hash).Error; err != nil {
		t.Fatalf("update hash: %v", err)
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/rest/windows/checkin", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+auth.LegacyAgentToken)
	ctx.Request.Header.Set("X-Device-Id", device.HardwareID)

	if AuthenticateDeviceRequest(ctx) {
		t.Fatal("expected legacy token to be rejected after migration")
	}
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
	}

	recorder = httptest.NewRecorder()
	ctx, _ = gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/rest/windows/checkin", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+raw)
	ctx.Request.Header.Set("X-Device-Id", device.HardwareID)

	if !AuthenticateDeviceRequest(ctx) {
		t.Fatalf("expected secure token to be accepted, status=%d body=%s", recorder.Code, recorder.Body.String())
	}
}
