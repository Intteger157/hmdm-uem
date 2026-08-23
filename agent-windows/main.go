package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	_ "embed"

	"github.com/hmdm/agent-windows/internal/agentstate"
	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/apps"
	"github.com/hmdm/agent-windows/internal/files"
	"github.com/hmdm/agent-windows/internal/brand"
	"github.com/hmdm/agent-windows/internal/commands"
	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/console"
	"github.com/hmdm/agent-windows/internal/policies"
	"github.com/hmdm/agent-windows/internal/service"
	"github.com/hmdm/agent-windows/internal/session"
	"github.com/hmdm/agent-windows/internal/setup"
	"github.com/hmdm/agent-windows/internal/system"
	"github.com/hmdm/agent-windows/internal/tray"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
)

//go:embed icon.ico
var iconData []byte

const (
	enrollmentRetryWait      = 30 * time.Second
	inventoryInterval        = 10 * time.Second
	policyComplianceInterval = time.Hour
)

var inflightInventoryCommands sync.Map
var inflightPollCommands sync.Map
var policySyncRunning int32

var (
	debugMode       = flag.Bool("debug", false, "run in console mode for debugging")
	trayMode        = flag.Bool("tray", false, "run system tray helper in the interactive user session")
	installMode     = flag.Bool("install", false, "configure Windows service autostart and tray helper Run registry entry")
	uninstallMode   = flag.Bool("uninstall", false, "notify MDM server that the agent is being removed")
	serverURL       = flag.String("server", "", "MDM server URL for debug when registry value is empty (e.g. https://mdm.example.com)")
	enrollmentToken = flag.String("token", "", "enrollment token for debug when registry value is empty")
)

func main() {
	flag.Parse()

	if err := run(); err != nil {
		log.Fatalf("%s: %v", brand.ServiceName, err)
	}
}

func run() error {
	cfg := config.LoadConfig(config.DebugOverrides{
		ServerURL:       *serverURL,
		EnrollmentToken: *enrollmentToken,
	})

	if *trayMode {
		console.HideWindow()
		detachStdin()
		if !tray.AcquireSingleInstance() {
			log.Printf("tray helper already running, exiting")
			return nil
		}
		log.Printf("starting Singularity MDM tray helper")
		tray.Run(iconData)
		return nil
	}

	if *installMode {
		exePath, err := os.Executable()
		if err != nil {
			return fmt.Errorf("resolve executable path: %w", err)
		}
		return setup.Install(exePath)
	}

	log.Printf("using server URL: %s", cfg.ServerURL)
	apiClient := api.NewAPIClient(cfg)

	if *uninstallMode {
		return runUninstallNotify(&cfg, apiClient)
	}

	inService, err := svc.IsWindowsService()
	if err != nil {
		return fmt.Errorf("determine service context: %w", err)
	}

	handler := &agentService{
		cfg:       cfg,
		apiClient: apiClient,
	}

	switch {
	case inService:
		return svc.Run(brand.ServiceName, handler)
	case *debugMode:
		log.Printf("%s starting in debug (console) mode", brand.ServiceName)
		go startTrayHelper()
		return debug.Run(brand.ServiceName, handler)
	default:
		fmt.Fprintf(os.Stderr, "use -debug to run %s in console mode\n", brand.ServiceName)
		os.Exit(2)
		return nil
	}
}

func runUninstallNotify(cfg *config.Config, apiClient *api.APIClient) error {
	if err := setup.RemoveTrayAutostart(); err != nil {
		log.Printf("remove tray autostart registry value: %v", err)
	}

	hardwareID, err := system.GetHardwareID()
	if err != nil {
		return fmt.Errorf("resolve hardware id: %w", err)
	}

	if cfg.AuthToken == "" {
		log.Printf("no auth token in registry, skipping uninstall notify")
		return nil
	}

	log.Printf("notifying server that agent is being removed (hwid=%s)", hardwareID)
	if err := apiClient.NotifyUninstall(cfg.AuthToken, hardwareID); err != nil {
		return fmt.Errorf("notify uninstall: %w", err)
	}

	log.Printf("uninstall notify succeeded")
	return nil
}

func performHandshake(cfg *config.Config, apiClient *api.APIClient, stop <-chan struct{}) error {
	hardwareID, err := system.GetHardwareID()
	if err != nil {
		return fmt.Errorf("resolve hardware id: %w", err)
	}

	cfg.HardwareID = hardwareID

	if err := agentstate.SaveDeviceID(hardwareID); err != nil {
		log.Printf("failed to persist agent state: %v", err)
	}

	if cfg.AuthToken != "" {
		log.Printf("AuthToken found. Agent is authenticated.")
		migrateAuthTokenIfNeeded(cfg, apiClient)
		return nil
	}

	log.Printf("No AuthToken. Starting enrollment with token: %s and HWID: %s", cfg.EnrollmentToken, cfg.HardwareID)
	return enrollUntilSuccess(cfg, apiClient, stop)
}

func enrollUntilSuccess(cfg *config.Config, apiClient *api.APIClient, stop <-chan struct{}) error {
	for {
		if cfg.EnrollmentToken == "" {
			log.Printf("enrollment token is empty, retrying in %s", enrollmentRetryWait)
			if waitOrStop(stop, enrollmentRetryWait) {
				return fmt.Errorf("stopped while waiting for enrollment token")
			}
			continue
		}

		authToken, err := apiClient.Enroll(cfg.EnrollmentToken, cfg.HardwareID)
		if err != nil {
			log.Printf("enrollment failed: %v, retrying in %s", err, enrollmentRetryWait)
			if waitOrStop(stop, enrollmentRetryWait) {
				return fmt.Errorf("stopped during enrollment")
			}
			continue
		}

		if err := config.SaveAuthToken(authToken); err != nil {
			log.Printf("failed to persist auth token: %v", err)
		}

		cfg.AuthToken = authToken
		// A fresh enrollment runs its provisioning phase again, so the handover
		// to the post-enrollment configuration must be re-armed.
		if err := policies.ClearProvisioningState(); err != nil {
			log.Printf("failed to reset provisioning state: %v", err)
		}
		log.Printf("enrollment succeeded, auth token stored")
		return nil
	}
}

func waitOrStop(stop <-chan struct{}, duration time.Duration) bool {
	timer := time.NewTimer(duration)
	defer timer.Stop()

	select {
	case <-stop:
		return true
	case <-timer.C:
		return false
	}
}

type agentService struct {
	cfg       config.Config
	apiClient *api.APIClient
	syncNow   chan struct{}
}

func (s *agentService) triggerSync(reason string) {
	if s.syncNow == nil {
		return
	}
	log.Printf("scheduling immediate sync: %s", reason)
	select {
	case s.syncNow <- struct{}{}:
	default:
	}
}

func (s *agentService) Execute(_ []string, requests <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	const accepts = svc.AcceptStop | svc.AcceptShutdown | svc.AcceptPowerEvent | svc.AcceptSessionChange

	status <- svc.Status{State: svc.StartPending}

	stopCh := make(chan struct{})
	s.syncNow = make(chan struct{}, 1)

	// Report RUNNING before network enrollment so MSI/service manager does not hang.
	go func() {
		if err := performHandshake(&s.cfg, s.apiClient, stopCh); err != nil {
			log.Printf("handshake failed: %v", err)
		}
		runAgentLoop(stopCh, s.syncNow, &s.cfg, s.apiClient)
	}()

	status <- svc.Status{State: svc.Running, Accepts: accepts}
	log.Printf("%s service started", brand.ServiceName)
	go startTrayHelper()

	for req := range requests {
		switch req.Cmd {
		case svc.Interrogate:
			status <- req.CurrentStatus
		case svc.PowerEvent:
			if service.ShouldSyncOnPowerEvent(req.EventType) {
				s.triggerSync(fmt.Sprintf("power event %d", req.EventType))
			}
			status <- svc.Status{State: svc.Running, Accepts: accepts}
		case svc.SessionChange:
			if service.ShouldSyncOnSessionEvent(req.EventType) {
				s.triggerSync(fmt.Sprintf("session event %d", req.EventType))
			}
			status <- svc.Status{State: svc.Running, Accepts: accepts}
		case svc.Stop, svc.Shutdown:
			log.Printf("%s service stopping", brand.ServiceName)
			status <- svc.Status{State: svc.StopPending}
			close(stopCh)
			status <- svc.Status{State: svc.Stopped}
			return false, 0
		default:
			log.Printf("%s unexpected control request: %d", brand.ServiceName, req.Cmd)
		}
	}

	return false, 0
}

func startTrayHelper() {
	exePath, err := os.Executable()
	if err != nil {
		log.Printf("tray helper: resolve executable path: %v", err)
		return
	}

	tray.StopExistingTrayHelpers()

	commandLine := fmt.Sprintf(`"%s" -tray`, filepath.Clean(exePath))
	if err := session.RunInteractive(commandLine); err != nil {
		log.Printf("tray helper launch failed: %v", err)
		return
	}

	log.Printf("tray helper launched in interactive session")
}

func runAgentLoop(stop <-chan struct{}, syncNow <-chan struct{}, cfg *config.Config, apiClient *api.APIClient) {
	ticker := time.NewTicker(inventoryInterval)
	defer ticker.Stop()

	commands.SetSyncInventoryHandler(func() error {
		_, err := uploadInventory(cfg, apiClient)
		return err
	})
	commands.SetApplyConfigurationHandler(func() (string, error) {
		return runForceApplyConfiguration(cfg, apiClient)
	})
	commands.SetAfterFactoryResetStarted(commands.DefaultAfterFactoryResetExit)

	go runPolicyComplianceLoop(stop, cfg, apiClient)

	policies.InitRequiredAppIDsFromCache()
	reconcileStaleAppInstallStatuses(cfg, apiClient)

	log.Printf("running immediate sync on agent start")
	runAgentCycle(stop, cfg, apiClient)

	for {
		select {
		case <-stop:
			return
		case <-syncNow:
			log.Printf("running immediate sync after resume")
			runAgentCycle(stop, cfg, apiClient)
		case <-ticker.C:
			runAgentCycle(stop, cfg, apiClient)
		}
	}
}

func runAgentCycle(stop <-chan struct{}, cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" {
		if err := enrollUntilSuccess(cfg, apiClient, stop); err != nil {
			log.Printf("re-enrollment interrupted: %v", err)
			return
		}
	}

	migrateAuthTokenIfNeeded(cfg, apiClient)

	checkinResult, err := apiClient.SendCheckin(cfg.AuthToken, cfg.HardwareID, policies.LoadLastSyncedConfigHash(), brand.AgentVersion)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("checkin failed: %v", err)
	} else {
		if checkinResult.ConfigChanged {
			log.Printf("checkin: configuration change detected (hash=%s)", checkinResult.ConfigHash)
		} else {
			log.Printf("checkin succeeded")
		}
	}

	pendingCommands, err := uploadInventory(cfg, apiClient)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("inventory upload failed: %v", err)
	} else {
		log.Printf("inventory upload succeeded")
		if err := processInventoryCommands(cfg, apiClient, pendingCommands); err != nil {
			if handleReenrollNeeded(cfg, err) {
				return
			}
			log.Printf("inventory command processing failed: %v", err)
		}
	}

	// Policy sync (including app deploy) runs asynchronously so jitter/downloads
	// never block the next heartbeat cycle.
	schedulePolicySync(cfg, apiClient)

	if err := processPendingCommands(stop, cfg, apiClient); err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("command processing failed: %v", err)
	}
}

func reconcileStaleAppInstallStatuses(cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return
	}

	items, err := apiClient.FetchDeviceAppStatuses(cfg.AuthToken, cfg.HardwareID)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("app deploy: stale status reconcile skipped: %v", err)
		return
	}

	snapshots := make([]apps.DeviceAppStatusSnapshot, 0, len(items))
	for _, item := range items {
		snapshots = append(snapshots, apps.DeviceAppStatusSnapshot{
			AppID:   item.AppID,
			AppName: item.AppName,
			Status:  item.Status,
		})
	}

	deployOpts := policies.NewAppDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
	apps.ReconcileStaleInstallStatuses(deployOpts.StatusReporter, snapshots)
}

func runPolicyComplianceLoop(stop <-chan struct{}, cfg *config.Config, apiClient *api.APIClient) {
	ticker := time.NewTicker(policyComplianceInterval)
	defer ticker.Stop()

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if cfg.AuthToken == "" {
				continue
			}
			reporter := policies.NewReporter(apiClient, cfg.AuthToken, cfg.HardwareID)
			deployOpts := policies.NewAppDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
			fileDeployOpts := policies.NewFileDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
			bitlockerUpload := policies.NewBitLockerKeyUploader(apiClient, cfg.AuthToken, cfg.HardwareID)
			if err := policies.RunComplianceCheck(reporter, deployOpts, fileDeployOpts, bitlockerUpload); err != nil {
				if handleReenrollNeeded(cfg, err) {
					continue
				}
				log.Printf("policy compliance check failed: %v", err)
			}
		}
	}
}

func schedulePolicySync(cfg *config.Config, apiClient *api.APIClient) {
	if !atomic.CompareAndSwapInt32(&policySyncRunning, 0, 1) {
		log.Printf("policy sync: already in progress, skipping")
		return
	}

	go func() {
		defer atomic.StoreInt32(&policySyncRunning, 0)
		syncPolicyFromServer(cfg, apiClient)
		reportProvisioningCompleteIfSettled(cfg, apiClient)
	}()
}

// reportProvisioningCompleteIfSettled hands the device over to the post-enrollment
// configuration once every pipeline of the enrollment configuration is applied.
// Deployments run asynchronously, so this is re-evaluated on every sync until the
// device settles, and then signaled exactly once per enrollment.
func reportProvisioningCompleteIfSettled(cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return
	}
	if policies.ProvisioningCompletionSignaled() {
		return
	}

	readiness := policies.EvaluateProvisioningReadiness()
	if !readiness.Settled {
		log.Printf("provisioning: not complete yet (%s)", readiness.Reason)
		return
	}

	profileID := policies.AssignedProfileID()
	log.Printf("provisioning: configuration fully applied, reporting completion to server")
	result, err := apiClient.ReportProvisioningComplete(cfg.AuthToken, cfg.HardwareID)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("provisioning: completion report failed: %v", err)
		return
	}

	if err := policies.MarkProvisioningCompletionSignaled(profileID); err != nil {
		log.Printf("provisioning: failed to save provisioning state: %v", err)
	}

	if !result.Changed {
		log.Printf("provisioning: server kept the current configuration")
		return
	}

	log.Printf(
		"provisioning: server moved device to configuration id=%d name=%q, applying it now",
		result.ConfigurationID,
		result.ConfigurationName,
	)
	syncPolicyFromServer(cfg, apiClient)
}

func syncPolicyFromServer(cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return
	}

	reporter := policies.NewReporter(apiClient, cfg.AuthToken, cfg.HardwareID)
	deployOpts := policies.NewAppDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
	fileDeployOpts := policies.NewFileDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
	bitlockerUpload := policies.NewBitLockerKeyUploader(apiClient, cfg.AuthToken, cfg.HardwareID)
	err := policies.SyncFromServer(func() (policies.EffectiveConfig, error) {
		return fetchEffectiveConfigFromServer(cfg, apiClient)
	}, reporter, deployOpts, fileDeployOpts, bitlockerUpload)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("policy sync failed: %v", err)
	}

	syncRegistryPoliciesFromServer(cfg, apiClient)
}

func syncRegistryPoliciesFromServer(cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return
	}

	reporter := policies.NewReporter(apiClient, cfg.AuthToken, cfg.HardwareID)
	err := policies.SyncRegistryPoliciesFromServer(func() (policies.RegistryPoliciesConfig, error) {
		return fetchRegistryPoliciesFromServer(cfg, apiClient)
	}, reporter)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("registry policy sync failed: %v", err)
	}
}

func runForceApplyConfiguration(cfg *config.Config, apiClient *api.APIClient) (string, error) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return "", fmt.Errorf("device not enrolled")
	}

	deployOpts := policies.NewAppDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
	// Force apply is admin driven: ignore the local deploy cache and let the real
	// machine state decide, so apps uninstalled on the device get reinstalled.
	deployOpts.ForceRecheck = true
	fileDeployOpts := policies.NewFileDeployOptions(apiClient, cfg.AuthToken, cfg.HardwareID)
	bitlockerUpload := policies.NewBitLockerKeyUploader(apiClient, cfg.AuthToken, cfg.HardwareID)

	return policies.ForceApplyConfiguration(
		func() (policies.EffectiveConfig, error) {
			return fetchEffectiveConfigForRecheck(cfg, apiClient)
		},
		func() (policies.RegistryPoliciesConfig, error) {
			return fetchRegistryPoliciesFromServer(cfg, apiClient)
		},
		deployOpts,
		fileDeployOpts,
		bitlockerUpload,
	)
}

func fetchEffectiveConfigFromServer(cfg *config.Config, apiClient *api.APIClient) (policies.EffectiveConfig, error) {
	return effectiveConfigFromResponse(apiClient.FetchEffectiveConfig(cfg.AuthToken, cfg.HardwareID))
}

func fetchEffectiveConfigForRecheck(cfg *config.Config, apiClient *api.APIClient) (policies.EffectiveConfig, error) {
	return effectiveConfigFromResponse(apiClient.FetchEffectiveConfigForRecheck(cfg.AuthToken, cfg.HardwareID))
}

func effectiveConfigFromResponse(response api.EffectiveConfigResponse, err error) (policies.EffectiveConfig, error) {
	if err != nil {
		if errors.Is(err, api.ErrNoEffectivePolicy) {
			return policies.EffectiveConfig{}, nil
		}
		return policies.EffectiveConfig{}, err
	}

	requiredApps := make([]apps.RequiredApp, 0, len(response.RequiredApps))
	for _, app := range response.RequiredApps {
		expectedVersion := strings.TrimSpace(app.ExpectedVersion)
		if expectedVersion == "" {
			expectedVersion = strings.TrimSpace(app.Version)
		}
		requiredApps = append(requiredApps, apps.RequiredApp{
			ID:                   app.ID,
			VersionID:            app.VersionID,
			Name:                 app.Name,
			Version:              app.Version,
			ExpectedVersionField: expectedVersion,
			UpdatedAt:            app.UpdatedAt,
			DownloadURL:          app.DownloadURL,
			InstallArgs:          app.InstallArgs,
			AppType:              app.AppType,
			WingetID:             app.WingetID,
			AutoUpdate:           app.AutoUpdate,
			UpdateFrequency:      app.UpdateFrequency,
		})
	}

	fileDeployments := make([]files.RequiredFileDeployment, 0, len(response.FileDeployments))
	for _, deployment := range response.FileDeployments {
		fileDeployments = append(fileDeployments, files.RequiredFileDeployment{
			ID:               deployment.ID,
			FileID:           deployment.FileID,
			OriginalName:     deployment.OriginalName,
			DownloadURL:      deployment.DownloadURL,
			SizeBytes:        deployment.SizeBytes,
			SHA256:           deployment.SHA256,
			DestinationPath:  deployment.DestinationPath,
			Unzip:            deployment.Unzip,
			PostActionScript: deployment.PostActionScript,
			UpdatedAt:        deployment.UpdatedAt,
		})
	}

	return policies.EffectiveConfig{
		Payload: policies.Payload{
			DefenderEnabled:   response.Payload.DefenderEnabled,
			BlockUsbStorage:   response.Payload.BlockUsbStorage,
			UsbReadOnly:       response.Payload.UsbReadOnly,
			ScreenLockTimeout: response.Payload.ScreenLockTimeout,
			RequireBitLocker:  response.Payload.RequireBitLocker,
		},
		RequiredApps:    requiredApps,
		FileDeployments: fileDeployments,
		ProfileID:       response.ProfileID,
		ProfileName:     response.ProfileName,
		Source:          response.Source,
	}, nil
}

func fetchRegistryPoliciesFromServer(cfg *config.Config, apiClient *api.APIClient) (policies.RegistryPoliciesConfig, error) {
	response, err := apiClient.FetchDeviceConfigurations(cfg.AuthToken, cfg.HardwareID)
	if err != nil {
		return policies.RegistryPoliciesConfig{}, err
	}

	items := make([]policies.RegistryPolicy, 0, len(response.Policies))
	for _, policy := range response.Policies {
		items = append(items, policies.RegistryPolicy{
			ID:         policy.ID,
			PolicyPath: policy.PolicyPath,
			ValueType:  policy.ValueType,
			Value:      policy.Value,
		})
	}

	return policies.RegistryPoliciesConfig{
		ConfigurationID:   response.ConfigurationID,
		ConfigurationName: response.ConfigurationName,
		Policies:          items,
	}, nil
}

func uploadInventory(cfg *config.Config, apiClient *api.APIClient) ([]api.PendingDeviceCommand, error) {
	info, err := system.CollectInfo()
	if err != nil {
		return nil, fmt.Errorf("inventory collection failed: %w", err)
	}

	commands, err := apiClient.SendInventory(cfg.AuthToken, cfg.HardwareID, info)
	if err != nil {
		return nil, err
	}
	return commands, nil
}

func processInventoryCommands(cfg *config.Config, apiClient *api.APIClient, pendingCommands []api.PendingDeviceCommand) error {
	for _, command := range pendingCommands {
		if _, loaded := inflightInventoryCommands.LoadOrStore(command.ID, true); loaded {
			continue
		}

		go func(command api.PendingDeviceCommand) {
			defer inflightInventoryCommands.Delete(command.ID)

			log.Printf("executing inventory command id=%d name=%s payload=%s", command.ID, command.CommandName, command.Payload)
			result := commands.ExecuteDeviceCommand(command.CommandName, command.Payload, commandExecuteOptions(cfg))
			if err := apiClient.SubmitCommandResult(cfg.AuthToken, cfg.HardwareID, command.ID, result.Success, result.Message); err != nil {
				log.Printf("inventory command id=%d result upload failed: %v", command.ID, err)
				return
			}
			log.Printf("inventory command id=%d finished success=%v", command.ID, result.Success)
		}(command)
	}
	return nil
}

func processPendingCommands(stop <-chan struct{}, cfg *config.Config, apiClient *api.APIClient) error {
	for {
		select {
		case <-stop:
			return nil
		default:
		}

		command, err := apiClient.PollCommand(cfg.AuthToken, cfg.HardwareID)
		if err != nil {
			return err
		}
		if command == nil {
			return nil
		}

		log.Printf("executing command id=%d action=%s", command.ID, command.Action)

		if command.Action == "sync" {
			if _, err := uploadInventory(cfg, apiClient); err != nil {
				reportErr := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, false, err.Error())
				if reportErr != nil {
					return reportErr
				}
				continue
			}
			if err := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, true, "inventory uploaded"); err != nil {
				return err
			}
			continue
		}

		if command.Action == "apply_configuration" {
			report, err := runForceApplyConfiguration(cfg, apiClient)
			if err != nil {
				if reportErr := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, false, err.Error()); reportErr != nil {
					return reportErr
				}
				continue
			}
			if err := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, true, report); err != nil {
				return err
			}
			continue
		}

		if isLongRunningPollAction(command.Action) {
			if _, loaded := inflightPollCommands.LoadOrStore(command.ID, true); loaded {
				continue
			}
			go executePolledCommand(cfg, apiClient, command)
			continue
		}

		result := commands.Execute(command.Action, command.Payload, commandExecuteOptions(cfg))
		if err := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, result.Success, result.Message); err != nil {
			return err
		}
		log.Printf("command id=%d finished success=%v message=%q", command.ID, result.Success, result.Message)
	}
}

func commandExecuteOptions(cfg *config.Config) *commands.ExecuteOptions {
	if cfg == nil {
		return nil
	}
	return &commands.ExecuteOptions{
		ServerURL:  cfg.ServerURL,
		AuthToken:  cfg.AuthToken,
		HardwareID: cfg.HardwareID,
	}
}

func isLongRunningPollAction(action string) bool {
	switch strings.ToLower(strings.TrimSpace(action)) {
	case "install", "powershell", "bitlocker_enable", commands.CommandNameRemoteSupport, commands.CommandNameStartTaskManager, commands.CommandNameStartFileExplorer:
		return true
	default:
		return false
	}
}

func executePolledCommand(cfg *config.Config, apiClient *api.APIClient, command *api.PendingCommand) {
	defer inflightPollCommands.Delete(command.ID)

	log.Printf("executing command id=%d action=%s (async)", command.ID, command.Action)
	result := commands.Execute(command.Action, command.Payload, commandExecuteOptions(cfg))
	if err := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, result.Success, result.Message); err != nil {
		log.Printf("command id=%d completion upload failed: %v", command.ID, err)
		return
	}
	log.Printf("command id=%d finished success=%v message=%q", command.ID, result.Success, result.Message)
}

func handleReenrollNeeded(cfg *config.Config, err error) bool {
	if !errors.Is(err, api.ErrUnauthorized) && !errors.Is(err, api.ErrDeviceNotFound) {
		return false
	}

	if errors.Is(err, api.ErrDeviceNotFound) {
		log.Printf("device not found on server, clearing auth token for re-enrollment")
	} else {
		log.Printf("request unauthorized, clearing auth token for re-enrollment")
	}

	if clearErr := config.ClearAuthToken(); clearErr != nil {
		log.Printf("failed to clear auth token: %v", clearErr)
	}
	cfg.AuthToken = ""
	return true
}

func detachStdin() {
	devNull, err := os.Open(os.DevNull)
	if err != nil {
		return
	}
	os.Stdin = devNull
}
