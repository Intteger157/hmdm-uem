package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/commands"
	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/policies"
	"github.com/hmdm/agent-windows/internal/system"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
)

const (
	serviceName              = "HMDMAgent"
	enrollmentRetryWait      = 30 * time.Second
	inventoryInterval        = 10 * time.Second
	policyComplianceInterval = time.Hour
)

var inflightInventoryCommands sync.Map

var (
	debugMode       = flag.Bool("debug", false, "run in console mode for debugging")
	uninstallMode   = flag.Bool("uninstall", false, "notify MDM server that the agent is being removed")
	serverURL       = flag.String("server", "", "MDM server URL for debug when registry value is empty (e.g. https://mdm.example.com)")
	enrollmentToken = flag.String("token", "", "enrollment token for debug when registry value is empty")
)

func main() {
	flag.Parse()

	if err := run(); err != nil {
		log.Fatalf("%s: %v", serviceName, err)
	}
}

func run() error {
	cfg := config.LoadConfig(config.DebugOverrides{
		ServerURL:       *serverURL,
		EnrollmentToken: *enrollmentToken,
	})
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
		return svc.Run(serviceName, handler)
	case *debugMode:
		log.Printf("%s starting in debug (console) mode", serviceName)
		return debug.Run(serviceName, handler)
	default:
		fmt.Fprintf(os.Stderr, "use -debug to run %s in console mode\n", serviceName)
		os.Exit(2)
		return nil
	}
}

func runUninstallNotify(cfg *config.Config, apiClient *api.APIClient) error {
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

	if cfg.AuthToken != "" {
		log.Printf("AuthToken found. Agent is authenticated.")
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
}

func (s *agentService) Execute(_ []string, requests <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	const accepts = svc.AcceptStop | svc.AcceptShutdown

	status <- svc.Status{State: svc.StartPending}

	stopCh := make(chan struct{})

	// Report RUNNING before network enrollment so MSI/service manager does not hang.
	go func() {
		if err := performHandshake(&s.cfg, s.apiClient, stopCh); err != nil {
			log.Printf("handshake failed: %v", err)
		}
		runAgentLoop(stopCh, &s.cfg, s.apiClient)
	}()

	status <- svc.Status{State: svc.Running, Accepts: accepts}
	log.Printf("%s service started", serviceName)

	for req := range requests {
		switch req.Cmd {
		case svc.Interrogate:
			status <- req.CurrentStatus
		case svc.Stop, svc.Shutdown:
			log.Printf("%s service stopping", serviceName)
			status <- svc.Status{State: svc.StopPending}
			close(stopCh)
			status <- svc.Status{State: svc.Stopped}
			return false, 0
		default:
			log.Printf("%s unexpected control request: %d", serviceName, req.Cmd)
		}
	}

	return false, 0
}

func runAgentLoop(stop <-chan struct{}, cfg *config.Config, apiClient *api.APIClient) {
	ticker := time.NewTicker(inventoryInterval)
	defer ticker.Stop()

	go runPolicyComplianceLoop(stop, cfg, apiClient)

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			if cfg.AuthToken == "" {
				if err := enrollUntilSuccess(cfg, apiClient, stop); err != nil {
					log.Printf("re-enrollment interrupted: %v", err)
					continue
				}
			}

			pendingCommands, err := uploadInventory(cfg, apiClient)
			if err != nil {
				if handleReenrollNeeded(cfg, err) {
					continue
				}
				log.Printf("inventory upload failed: %v", err)
			} else {
				log.Printf("inventory upload succeeded")
				if err := processInventoryCommands(cfg, apiClient, pendingCommands); err != nil {
					if handleReenrollNeeded(cfg, err) {
						continue
					}
					log.Printf("inventory command processing failed: %v", err)
				}
				syncPolicyFromServer(cfg, apiClient)
			}

			if err := processPendingCommands(stop, cfg, apiClient); err != nil {
				if handleReenrollNeeded(cfg, err) {
					continue
				}
				log.Printf("command processing failed: %v", err)
			}
		}
	}
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
			if err := policies.RunComplianceCheck(reporter); err != nil {
				if handleReenrollNeeded(cfg, err) {
					continue
				}
				log.Printf("policy compliance check failed: %v", err)
			}
		}
	}
}

func syncPolicyFromServer(cfg *config.Config, apiClient *api.APIClient) {
	if cfg.AuthToken == "" || cfg.HardwareID == "" {
		return
	}

	reporter := policies.NewReporter(apiClient, cfg.AuthToken, cfg.HardwareID)
	err := policies.SyncFromServer(func() (policies.EffectiveConfig, error) {
		response, err := apiClient.FetchEffectiveConfig(cfg.AuthToken, cfg.HardwareID)
		if err != nil {
			return policies.EffectiveConfig{}, err
		}
		return policies.EffectiveConfig{
			Payload: policies.Payload{
				DefenderEnabled:   response.Payload.DefenderEnabled,
				BlockUsbStorage:   response.Payload.BlockUsbStorage,
				ScreenLockTimeout: response.Payload.ScreenLockTimeout,
			},
			ProfileID:   response.ProfileID,
			ProfileName: response.ProfileName,
			Source:      response.Source,
		}, nil
	}, reporter)
	if err != nil {
		if handleReenrollNeeded(cfg, err) {
			return
		}
		log.Printf("policy sync failed: %v", err)
	}
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

		func(command api.PendingDeviceCommand) {
			defer inflightInventoryCommands.Delete(command.ID)

			log.Printf("executing inventory command id=%d name=%s payload=%s", command.ID, command.CommandName, command.Payload)
			result := commands.ExecuteDeviceCommand(command.CommandName, command.Payload)
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

		result := commands.Execute(command.Action, command.Payload)
		if err := apiClient.CompleteCommand(cfg.AuthToken, cfg.HardwareID, command.ID, result.Success, result.Message); err != nil {
			return err
		}
		log.Printf("command id=%d finished success=%v message=%q", command.ID, result.Success, result.Message)
	}
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
