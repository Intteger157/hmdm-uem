package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/handlers"
	"github.com/hmdm/server-windows/internal/middleware"
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

	// Console operators authenticate with the JWT minted by the Java server, so
	// both servers must be configured with the same signing secret.
	registerRoutes(router, handlers.NewWindowsHandler(), os.Getenv("JWT_SECRET"))

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

// registerRoutes wires every HTTP route onto the router, split into the four
// trust zones: public, Windows agent protocol, shared agent/console, and
// console-only.
func registerRoutes(router *gin.Engine, windowsHandler *handlers.WindowsHandler, jwtSecret string) {
	adminOnly := middleware.AdminAuth(jwtSecret)
	adminOrAgent := middleware.AdminOrAgent(jwtSecret)
	// Ordered after adminOnly everywhere it is used: it authorises the role that
	// AdminAuth resolves. The shared agent/console group is deliberately left
	// out — its only route is a read, and an agent request carries no role for
	// this to authorise.
	accessLevel := middleware.RequireAccessLevel()
	consoleAdmin := middleware.RequireConsoleAdministrator()

	router.GET("/storage/files/*filepath", windowsHandler.ServeStoredFile)

	// Public bootstrap endpoints (no auth — OOBE machines have no session/JWT).
	router.GET("/api/windows/enroll", windowsHandler.GetEnrollBootstrapScript)
	router.GET("/rest/windows/enroll", windowsHandler.GetEnrollBootstrapScript)
	router.GET("/api/public/device-info/:deviceId", windowsHandler.GetPublicDeviceInfo)
	router.GET("/api/auth/sso-status", windowsHandler.GetPublicSSOStatus)
	router.GET("/rest/auth/sso-status", windowsHandler.GetPublicSSOStatus)
	router.GET("/api/auth/login/microsoft", windowsHandler.StartMicrosoftOAuth)
	router.GET("/rest/auth/login/microsoft", windowsHandler.StartMicrosoftOAuth)
	router.GET("/api/auth/callback/microsoft", windowsHandler.MicrosoftOAuthCallback)
	router.GET("/rest/auth/callback/microsoft", windowsHandler.MicrosoftOAuthCallback)
	router.GET("/api/windows/public/sso-status", windowsHandler.GetPublicSSOStatus)
	router.GET("/api/windows/public/auth/login/microsoft", windowsHandler.StartMicrosoftOAuth)
	router.GET("/api/windows/public/auth/callback/microsoft", windowsHandler.MicrosoftOAuthCallback)
	router.POST("/api/windows/register", windowsHandler.RegisterBootstrap)
	router.GET(appstorage.AgentPublicPath(), windowsHandler.DownloadAgentBinary)

	// Agent-side WebSocket relays. Agents present their enrollment token, which
	// each handler checks itself.
	router.GET("/api/terminal/client", windowsHandler.HandleAgentTerminal)
	router.GET("/api/terminal/agent", windowsHandler.HandleAgentTerminal)
	router.GET("/api/taskmgr/agent", windowsHandler.HandleAgentTaskManager)
	router.GET("/api/filexplorer/agent", windowsHandler.HandleAgentFileExplorer)

	// Operator-side WebSocket relays. The browser cannot set headers on a
	// handshake, so the console JWT arrives as the "token" query parameter.
	adminSockets := router.Group("/api", adminOnly, accessLevel)
	{
		adminSockets.GET("/terminal/operator", windowsHandler.HandleAdminTerminal)
		adminSockets.GET("/terminal/admin", windowsHandler.HandleAdminTerminal)
		adminSockets.GET("/taskmgr/admin", windowsHandler.HandleAdminTaskManager)
		adminSockets.GET("/filexplorer/admin", windowsHandler.HandleAdminFileExplorer)
	}

	rest := router.Group("/rest")
	{
		// Unauthenticated: liveness probe and one-time installer download links
		// fetched by the bootstrap script before a device has any credentials.
		public := rest.Group("/windows")
		{
			public.GET("/health", func(c *gin.Context) {
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})
			public.GET("/downloads/:downloadToken", windowsHandler.DownloadInstaller)
			public.GET("/public/sso-status", windowsHandler.GetPublicSSOStatus)
			public.GET("/public/auth/login/microsoft", windowsHandler.StartMicrosoftOAuth)
			public.GET("/public/auth/callback/microsoft", windowsHandler.MicrosoftOAuthCallback)
		}

		// Windows agent protocol. These routes keep their existing enrollment
		// token / bearer checks inside the handlers; a console JWT is neither
		// sent nor expected here.
		agent := rest.Group("/windows")
		{
			agent.POST("/enroll", windowsHandler.Enroll)
			agent.POST("/checkin", windowsHandler.Checkin)
			agent.POST("/inventory", windowsHandler.Inventory)
			agent.POST("/uninstall", windowsHandler.Uninstall)
			agent.GET("/commands/poll", windowsHandler.PollCommand)
			agent.POST("/commands/:commandId/complete", windowsHandler.CompleteCommand)
			agent.POST("/commands/:commandId/result", windowsHandler.SubmitCommandResult)
			agent.GET("/devices/:hardwareId/configurations", windowsHandler.GetDeviceConfigurations)
			agent.POST("/devices/:hardwareId/policy-enforcement", windowsHandler.ReportPolicyEnforcement)
			agent.POST("/devices/:hardwareId/bitlocker-key", windowsHandler.SubmitBitLockerKey)
			agent.POST("/devices/:hardwareId/apps/status", windowsHandler.ReportDeviceAppStatus)
			agent.POST("/devices/:hardwareId/logs/app-install", windowsHandler.ReportAppInstallLog)
			agent.POST("/devices/:hardwareId/logs/file-deployment", windowsHandler.ReportFileDeploymentLog)
		}

		// Called by both the agent (to apply policy) and the console (to preview
		// it), so either credential is accepted.
		shared := rest.Group("/windows", adminOrAgent)
		{
			shared.GET("/devices/:hardwareId/effective-config", windowsHandler.GetDeviceEffectiveConfig)
		}

		// Console API. Fail-closed: a valid console JWT whose role permits the
		// Windows platform and meets the route's access level is required for
		// every route below.
		admin := rest.Group("/windows", adminOnly, accessLevel)
		{
			admin.GET("/devices", windowsHandler.ListDevices)
			admin.GET("/devices/:hardwareId", windowsHandler.GetDevice)
			admin.PATCH("/devices/:hardwareId/group", windowsHandler.UpdateDeviceGroupMembership)
			admin.DELETE("/devices/:hardwareId", windowsHandler.DeleteDevice)
			admin.POST("/devices/:hardwareId/commands", windowsHandler.EnqueueCommand)
			admin.GET("/devices/:hardwareId/commands/latest", windowsHandler.GetLatestCommand)
			admin.GET("/devices/:hardwareId/logs", windowsHandler.ListDeviceCommandLogs)
			admin.GET("/devices/:hardwareId/terminal", windowsHandler.HandleAdminTerminal)
			admin.GET("/devices/:hardwareId/services", windowsHandler.GetDeviceServices)
			admin.POST("/devices/:hardwareId/services/refresh", windowsHandler.RefreshDeviceServices)
			admin.POST("/devices/:hardwareId/services/:serviceName/restart", windowsHandler.RestartDeviceService)
			admin.GET("/enrollment-setup", windowsHandler.GetEnrollmentSetup)
			admin.GET("/enrollment-provisioning", windowsHandler.GetEnrollmentProvisioning)
			admin.PUT("/enrollment-provisioning", windowsHandler.UpdateEnrollmentProvisioning)
			admin.GET("/enrollment-security", windowsHandler.GetEnrollmentSecurity)
			admin.PUT("/enrollment-security", windowsHandler.UpdateEnrollmentSecurity)
			admin.GET("/autopilot-agent", windowsHandler.GetAutopilotAgent)
			admin.POST("/autopilot-agent/upload", windowsHandler.UploadAutopilotAgent)
			admin.POST("/enrollment-token", windowsHandler.CreateEnrollmentToken)
			admin.GET("/installers/default", windowsHandler.GetDefaultInstaller)
			admin.POST("/installers/default", windowsHandler.RegisterDefaultInstaller)
			admin.POST("/installers/link", windowsHandler.LinkInstaller)
			admin.GET("/configurations", windowsHandler.ListConfigProfiles)
			admin.POST("/configurations", windowsHandler.CreateConfigProfile)
			admin.GET("/configurations/:id", windowsHandler.GetConfigProfile)
			admin.PUT("/configurations/:id", windowsHandler.UpdateConfigProfile)
			admin.DELETE("/configurations/:id", windowsHandler.DeleteConfigProfile)
			admin.GET("/configurations/:id/assignments", windowsHandler.GetConfigProfileAssignments)
			admin.POST("/configurations/:id/assign", windowsHandler.AssignConfigProfile)
			admin.GET("/configurations/:id/apps", windowsHandler.GetConfigProfileApps)
			admin.POST("/configurations/:id/apps", windowsHandler.AssignConfigProfileApps)
			admin.GET("/configurations/:id/policies", windowsHandler.GetConfigProfilePolicies)
			admin.PUT("/configurations/:id/policies", windowsHandler.ReplaceConfigProfilePolicies)
			admin.GET("/configurations/:id/file-deployments", windowsHandler.GetConfigProfileFileDeployments)
			admin.POST("/configurations/:id/file-deployments", windowsHandler.AssignConfigProfileFileDeployments)
			admin.GET("/files", windowsHandler.ListStoredFiles)
			admin.POST("/files/upload", windowsHandler.UploadStoredFile)
			admin.DELETE("/files/:id", windowsHandler.DeleteStoredFile)
			admin.GET("/scripts", windowsHandler.ListPowerShellScripts)
			admin.POST("/scripts", windowsHandler.CreatePowerShellScript)
			admin.GET("/scripts/:id", windowsHandler.GetPowerShellScript)
			admin.PUT("/scripts/:id", windowsHandler.UpdatePowerShellScript)
			admin.DELETE("/scripts/:id", windowsHandler.DeletePowerShellScript)
			admin.GET("/apps", windowsHandler.ListSoftwareApps)
			admin.POST("/applications/upload", windowsHandler.UploadApplication)
			admin.POST("/apps", windowsHandler.CreateSoftwareApp)
			admin.GET("/apps/:id", windowsHandler.GetSoftwareApp)
			admin.PUT("/apps/:id", windowsHandler.UpdateSoftwareApp)
			admin.POST("/apps/:id/versions", windowsHandler.CreateApplicationVersion)
			admin.DELETE("/apps/:id/versions/:versionId", windowsHandler.DeleteApplicationVersion)
			admin.DELETE("/apps/:id", windowsHandler.DeleteSoftwareApp)
			admin.GET("/devices/:hardwareId/apps/status", windowsHandler.GetDeviceAppStatuses)
			admin.POST("/devices/:hardwareId/apps/:appId/assign", windowsHandler.AssignDeviceApp)
			admin.DELETE("/devices/:hardwareId/apps/:appId/assign", windowsHandler.UnassignDeviceApp)
			admin.POST("/devices/:hardwareId/apps/:appId/retry", windowsHandler.RetryDeviceApp)
			admin.GET("/groups", windowsHandler.ListDeviceGroups)
			admin.POST("/groups", windowsHandler.CreateDeviceGroup)
			admin.PUT("/groups/:id", windowsHandler.UpdateDeviceGroup)
			admin.DELETE("/groups/:id", windowsHandler.DeleteDeviceGroup)
			// Role administration writes the scope and level columns that every
			// check above reads, so it takes the stricter console-admin guard.
			admin.GET("/roles", consoleAdmin, windowsHandler.ListRoleMatrix)
			admin.PUT("/roles/:roleId", consoleAdmin, windowsHandler.UpdateRoleMatrix)
			admin.GET("/console/roles", consoleAdmin, windowsHandler.ListConsoleRoles)
			admin.GET("/console/role-permissions", consoleAdmin, windowsHandler.ListConsoleRolePermissions)
			admin.GET("/console/users", consoleAdmin, windowsHandler.ListConsoleUsers)
			admin.GET("/console/user-roles", consoleAdmin, windowsHandler.ListConsoleUserRoles)
			admin.PUT("/console/users", consoleAdmin, windowsHandler.UpsertConsoleUser)
			admin.DELETE("/console/users/:userId", consoleAdmin, windowsHandler.DeleteConsoleUser)
			admin.GET("/console/settings", consoleAdmin, windowsHandler.GetConsoleSettings)
			admin.POST("/android/devices/search", windowsHandler.SearchAndroidDevices)
			admin.GET("/android/devices/number/:number", windowsHandler.GetAndroidDeviceByNumber)
			admin.GET("/me", windowsHandler.GetConsoleProfile)
			admin.GET("/sso-settings", windowsHandler.GetSSOSettings)
			admin.PUT("/sso-settings", windowsHandler.UpdateSSOSettings)
		}

		// Console-wide SSO settings. High access level is enforced by the route
		// policy table; these routes are platform-agnostic like /roles and /me.
		ssoAdmin := rest.Group("/sso", adminOnly, accessLevel)
		{
			ssoAdmin.GET("/settings", windowsHandler.GetSSOSettings)
			ssoAdmin.PUT("/settings", windowsHandler.UpdateSSOSettings)
		}
	}

	// Mirror SSO settings under /api/sso for gateways that prefix console calls
	// with /api instead of /rest.
	apiSSO := router.Group("/api/sso", adminOnly, accessLevel)
	{
		apiSSO.GET("/settings", windowsHandler.GetSSOSettings)
		apiSSO.PUT("/settings", windowsHandler.UpdateSSOSettings)
	}

	// Mirror the console-wide endpoints under /api/windows for gateways and SPA
	// builds that prefix console calls with /api instead of /rest.
	apiAdmin := router.Group("/api/windows", adminOnly, accessLevel)
	{
		apiAdmin.GET("/roles", consoleAdmin, windowsHandler.ListRoleMatrix)
		apiAdmin.PUT("/roles/:roleId", consoleAdmin, windowsHandler.UpdateRoleMatrix)
		apiAdmin.GET("/console/roles", consoleAdmin, windowsHandler.ListConsoleRoles)
		apiAdmin.GET("/console/role-permissions", consoleAdmin, windowsHandler.ListConsoleRolePermissions)
		apiAdmin.GET("/console/users", consoleAdmin, windowsHandler.ListConsoleUsers)
		apiAdmin.GET("/console/user-roles", consoleAdmin, windowsHandler.ListConsoleUserRoles)
		apiAdmin.PUT("/console/users", consoleAdmin, windowsHandler.UpsertConsoleUser)
		apiAdmin.DELETE("/console/users/:userId", consoleAdmin, windowsHandler.DeleteConsoleUser)
		apiAdmin.GET("/console/settings", consoleAdmin, windowsHandler.GetConsoleSettings)
		apiAdmin.POST("/android/devices/search", windowsHandler.SearchAndroidDevices)
		apiAdmin.GET("/android/devices/number/:number", windowsHandler.GetAndroidDeviceByNumber)
		apiAdmin.GET("/me", windowsHandler.GetConsoleProfile)
		apiAdmin.GET("/sso-settings", windowsHandler.GetSSOSettings)
		apiAdmin.PUT("/sso-settings", windowsHandler.UpdateSSOSettings)
	}

	// Android console routes served by Go so SSO sessions do not depend on Java JWT.
	androidAdmin := router.Group("/rest/android", adminOnly, accessLevel)
	{
		androidAdmin.POST("/devices/search", windowsHandler.SearchAndroidDevices)
		androidAdmin.GET("/devices/number/:number", windowsHandler.GetAndroidDeviceByNumber)
	}

	apiAndroid := router.Group("/api/android", adminOnly, accessLevel)
	{
		apiAndroid.POST("/devices/search", windowsHandler.SearchAndroidDevices)
		apiAndroid.GET("/devices/number/:number", windowsHandler.GetAndroidDeviceByNumber)
	}
}
