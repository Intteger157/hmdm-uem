package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/handlers"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

const (
	defaultDSN       = "host=localhost user=postgres password=postgres dbname=hmdm port=5432 sslmode=disable"
	defaultListenAddr = ":8082"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = defaultDSN
	}

	if _, err := db.InitDB(dsn); err != nil {
		log.Fatalf("database init failed: %v", err)
	}

	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = defaultListenAddr
	}

	router := gin.Default()

	if err := appstorage.EnsureAppsDirectory(); err != nil {
		log.Printf("apps storage directory init failed: %v", err)
	}
	router.StaticFS("/storage/apps", gin.Dir(appstorage.AppsDirectory(), false))

	windowsHandler := handlers.NewWindowsHandler()
	rest := router.Group("/rest")
	{
		windows := rest.Group("/windows")
		{
			windows.GET("/health", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})
			windows.GET("/devices", windowsHandler.ListDevices)
			windows.GET("/devices/:hardwareId", windowsHandler.GetDevice)
			windows.PATCH("/devices/:hardwareId/group", windowsHandler.UpdateDeviceGroupMembership)
			windows.GET("/devices/:hardwareId/effective-config", windowsHandler.GetDeviceEffectiveConfig)
			windows.POST("/devices/:hardwareId/policy-enforcement", windowsHandler.ReportPolicyEnforcement)
			windows.POST("/devices/:hardwareId/logs/app-install", windowsHandler.ReportAppInstallLog)
			windows.DELETE("/devices/:hardwareId", windowsHandler.DeleteDevice)
			windows.POST("/devices/:hardwareId/commands", windowsHandler.EnqueueCommand)
			windows.GET("/devices/:hardwareId/commands/latest", windowsHandler.GetLatestCommand)
			windows.GET("/devices/:hardwareId/logs", windowsHandler.ListDeviceCommandLogs)
			windows.GET("/devices/:hardwareId/services", windowsHandler.GetDeviceServices)
			windows.POST("/devices/:hardwareId/services/refresh", windowsHandler.RefreshDeviceServices)
			windows.POST("/devices/:hardwareId/services/:serviceName/restart", windowsHandler.RestartDeviceService)
			windows.GET("/enrollment-setup", windowsHandler.GetEnrollmentSetup)
			windows.POST("/enrollment-token", windowsHandler.CreateEnrollmentToken)
			windows.GET("/installers/default", windowsHandler.GetDefaultInstaller)
			windows.POST("/installers/default", windowsHandler.RegisterDefaultInstaller)
			windows.POST("/installers/link", windowsHandler.LinkInstaller)
			windows.GET("/downloads/:downloadToken", windowsHandler.DownloadInstaller)
			windows.POST("/enroll", windowsHandler.Enroll)
			windows.POST("/inventory", windowsHandler.Inventory)
			windows.POST("/uninstall", windowsHandler.Uninstall)
			windows.GET("/commands/poll", windowsHandler.PollCommand)
			windows.POST("/commands/:commandId/complete", windowsHandler.CompleteCommand)
			windows.POST("/commands/:commandId/result", windowsHandler.SubmitCommandResult)
			windows.GET("/configurations", windowsHandler.ListConfigProfiles)
			windows.POST("/configurations", windowsHandler.CreateConfigProfile)
			windows.GET("/configurations/:id", windowsHandler.GetConfigProfile)
			windows.PUT("/configurations/:id", windowsHandler.UpdateConfigProfile)
			windows.DELETE("/configurations/:id", windowsHandler.DeleteConfigProfile)
			windows.GET("/configurations/:id/assignments", windowsHandler.GetConfigProfileAssignments)
			windows.POST("/configurations/:id/assign", windowsHandler.AssignConfigProfile)
			windows.GET("/configurations/:id/apps", windowsHandler.GetConfigProfileApps)
			windows.POST("/configurations/:id/apps", windowsHandler.AssignConfigProfileApps)
			windows.GET("/apps", windowsHandler.ListSoftwareApps)
			windows.POST("/applications/upload", windowsHandler.UploadApplication)
			windows.POST("/apps", windowsHandler.CreateSoftwareApp)
			windows.GET("/apps/:id", windowsHandler.GetSoftwareApp)
			windows.PUT("/apps/:id", windowsHandler.UpdateSoftwareApp)
			windows.DELETE("/apps/:id", windowsHandler.DeleteSoftwareApp)
			windows.GET("/devices/:hardwareId/apps/status", windowsHandler.GetDeviceAppStatuses)
			windows.POST("/devices/:hardwareId/apps/status", windowsHandler.ReportDeviceAppStatus)
			windows.POST("/devices/:hardwareId/apps/:appId/assign", windowsHandler.AssignDeviceApp)
			windows.DELETE("/devices/:hardwareId/apps/:appId/assign", windowsHandler.UnassignDeviceApp)
			windows.GET("/groups", windowsHandler.ListDeviceGroups)
			windows.POST("/groups", windowsHandler.CreateDeviceGroup)
		}
	}

	log.Printf("server-windows listening on %s", listenAddr)
	if err := router.Run(listenAddr); err != nil {
		log.Fatal(err)
	}
}
