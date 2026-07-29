package main

import (
	"log"
	"net/http"
	"os"
	"time"

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
	// Keep multipart parsing memory small so large uploads spill to disk instead of RAM.
	router.MaxMultipartMemory = 32 << 20

	if err := appstorage.EnsureAppsDirectory(); err != nil {
		log.Printf("apps storage directory init failed: %v", err)
	}
	appsDir := appstorage.AppsDirectory()
	if entries, err := os.ReadDir(appsDir); err != nil {
		log.Printf("apps storage directory %q unreadable: %v", appsDir, err)
	} else {
		log.Printf("apps storage directory %q (%d file(s)) served at /storage/apps/", appsDir, len(entries))
	}
	router.StaticFS("/storage/apps", gin.Dir(appsDir, false))

	if err := appstorage.EnsureFilesDirectory(); err != nil {
		log.Printf("files storage directory init failed: %v", err)
	}
	filesDir := appstorage.FilesDirectory()
	if entries, err := os.ReadDir(filesDir); err != nil {
		log.Printf("files storage directory %q unreadable: %v", filesDir, err)
	} else {
		log.Printf("files storage directory %q (%d file(s)) served at /storage/files/", filesDir, len(entries))
	}

	if err := appstorage.EnsureAgentDirectory(); err != nil {
		log.Printf("agent storage directory init failed: %v", err)
	}
	agentBinaryPath := appstorage.AgentBinaryPath()
	if appstorage.AgentBinaryConfigured() {
		log.Printf("agent binary %q served at %s", agentBinaryPath, appstorage.AgentPublicPath())
	} else {
		log.Printf("autopilot agent binary missing at %q — publish files/singularity-autopilot/singularity-agent.exe for bootstrap enrollment", agentBinaryPath)
	}

	windowsHandler := handlers.NewWindowsHandler()
	router.GET("/storage/files/*filepath", windowsHandler.ServeStoredFile)

	// Live terminal WebSocket relay.
	router.GET("/api/terminal/operator", windowsHandler.HandleAdminTerminal)
	router.GET("/api/terminal/client", windowsHandler.HandleAgentTerminal)
	router.GET("/api/terminal/admin", windowsHandler.HandleAdminTerminal)
	router.GET("/api/terminal/agent", windowsHandler.HandleAgentTerminal)

	// Remote task manager WebSocket relay.
	router.GET("/api/taskmgr/admin", windowsHandler.HandleAdminTaskManager)
	router.GET("/api/taskmgr/agent", windowsHandler.HandleAgentTaskManager)

	// Public bootstrap endpoints (no auth — OOBE machines have no session/JWT).
	router.GET("/api/windows/enroll", windowsHandler.GetEnrollBootstrapScript)
	router.GET("/rest/windows/enroll", windowsHandler.GetEnrollBootstrapScript)
	router.GET("/api/public/device-info/:deviceId", windowsHandler.GetPublicDeviceInfo)
	router.POST("/api/windows/register", windowsHandler.RegisterBootstrap)
	router.GET(appstorage.AgentPublicPath(), windowsHandler.DownloadAgentBinary)
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
			windows.GET("/devices/:hardwareId/configurations", windowsHandler.GetDeviceConfigurations)
			windows.GET("/devices/:hardwareId/effective-config", windowsHandler.GetDeviceEffectiveConfig)
			windows.POST("/devices/:hardwareId/policy-enforcement", windowsHandler.ReportPolicyEnforcement)
			windows.POST("/devices/:hardwareId/logs/app-install", windowsHandler.ReportAppInstallLog)
			windows.POST("/devices/:hardwareId/logs/file-deployment", windowsHandler.ReportFileDeploymentLog)
			windows.DELETE("/devices/:hardwareId", windowsHandler.DeleteDevice)
			windows.POST("/devices/:hardwareId/commands", windowsHandler.EnqueueCommand)
			windows.GET("/devices/:hardwareId/commands/latest", windowsHandler.GetLatestCommand)
			windows.GET("/devices/:hardwareId/logs", windowsHandler.ListDeviceCommandLogs)
			windows.GET("/devices/:hardwareId/terminal", windowsHandler.HandleAdminTerminal)
			windows.GET("/devices/:hardwareId/services", windowsHandler.GetDeviceServices)
			windows.POST("/devices/:hardwareId/services/refresh", windowsHandler.RefreshDeviceServices)
			windows.POST("/devices/:hardwareId/services/:serviceName/restart", windowsHandler.RestartDeviceService)
			windows.GET("/enrollment-setup", windowsHandler.GetEnrollmentSetup)
			windows.GET("/enrollment-provisioning", windowsHandler.GetEnrollmentProvisioning)
			windows.PUT("/enrollment-provisioning", windowsHandler.UpdateEnrollmentProvisioning)
			windows.GET("/enrollment-security", windowsHandler.GetEnrollmentSecurity)
			windows.PUT("/enrollment-security", windowsHandler.UpdateEnrollmentSecurity)
			windows.GET("/autopilot-agent", windowsHandler.GetAutopilotAgent)
			windows.POST("/autopilot-agent/upload", windowsHandler.UploadAutopilotAgent)
			windows.POST("/enrollment-token", windowsHandler.CreateEnrollmentToken)
			windows.GET("/installers/default", windowsHandler.GetDefaultInstaller)
			windows.POST("/installers/default", windowsHandler.RegisterDefaultInstaller)
			windows.POST("/installers/link", windowsHandler.LinkInstaller)
			windows.GET("/downloads/:downloadToken", windowsHandler.DownloadInstaller)
			windows.POST("/enroll", windowsHandler.Enroll)
			windows.POST("/checkin", windowsHandler.Checkin)
			windows.POST("/inventory", windowsHandler.Inventory)
			windows.POST("/devices/:hardwareId/bitlocker-key", windowsHandler.SubmitBitLockerKey)
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
			windows.GET("/configurations/:id/policies", windowsHandler.GetConfigProfilePolicies)
			windows.PUT("/configurations/:id/policies", windowsHandler.ReplaceConfigProfilePolicies)
			windows.GET("/configurations/:id/file-deployments", windowsHandler.GetConfigProfileFileDeployments)
			windows.POST("/configurations/:id/file-deployments", windowsHandler.AssignConfigProfileFileDeployments)
			windows.GET("/files", windowsHandler.ListStoredFiles)
			windows.POST("/files/upload", windowsHandler.UploadStoredFile)
			windows.DELETE("/files/:id", windowsHandler.DeleteStoredFile)
			windows.GET("/scripts", windowsHandler.ListPowerShellScripts)
			windows.POST("/scripts", windowsHandler.CreatePowerShellScript)
			windows.GET("/scripts/:id", windowsHandler.GetPowerShellScript)
			windows.PUT("/scripts/:id", windowsHandler.UpdatePowerShellScript)
			windows.DELETE("/scripts/:id", windowsHandler.DeletePowerShellScript)
			windows.GET("/apps", windowsHandler.ListSoftwareApps)
			windows.POST("/applications/upload", windowsHandler.UploadApplication)
			windows.POST("/apps", windowsHandler.CreateSoftwareApp)
			windows.GET("/apps/:id", windowsHandler.GetSoftwareApp)
			windows.PUT("/apps/:id", windowsHandler.UpdateSoftwareApp)
			windows.POST("/apps/:id/versions", windowsHandler.CreateApplicationVersion)
			windows.DELETE("/apps/:id/versions/:versionId", windowsHandler.DeleteApplicationVersion)
			windows.DELETE("/apps/:id", windowsHandler.DeleteSoftwareApp)
			windows.GET("/devices/:hardwareId/apps/status", windowsHandler.GetDeviceAppStatuses)
			windows.POST("/devices/:hardwareId/apps/status", windowsHandler.ReportDeviceAppStatus)
			windows.POST("/devices/:hardwareId/apps/:appId/assign", windowsHandler.AssignDeviceApp)
			windows.DELETE("/devices/:hardwareId/apps/:appId/assign", windowsHandler.UnassignDeviceApp)
			windows.POST("/devices/:hardwareId/apps/:appId/retry", windowsHandler.RetryDeviceApp)
			windows.GET("/groups", windowsHandler.ListDeviceGroups)
			windows.POST("/groups", windowsHandler.CreateDeviceGroup)
		}
	}

	uploadTimeout := 60 * time.Minute
	srv := &http.Server{
		Addr:         listenAddr,
		Handler:      router,
		ReadTimeout:  uploadTimeout,
		WriteTimeout: uploadTimeout,
		IdleTimeout:  uploadTimeout,
	}

	log.Printf("server-windows listening on %s (upload timeouts=%s)", listenAddr, uploadTimeout)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
