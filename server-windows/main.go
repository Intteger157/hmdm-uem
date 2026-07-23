package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/handlers"
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
			windows.GET("/groups", windowsHandler.ListDeviceGroups)
			windows.POST("/groups", windowsHandler.CreateDeviceGroup)
		}
	}

	log.Printf("server-windows listening on %s", listenAddr)
	if err := router.Run(listenAddr); err != nil {
		log.Fatal(err)
	}
}
