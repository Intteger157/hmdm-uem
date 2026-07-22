package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/hmdm/agent-windows/internal/api"
	"github.com/hmdm/agent-windows/internal/config"
	"github.com/hmdm/agent-windows/internal/system"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/debug"
)

const (
	serviceName         = "HMDMAgent"
	enrollmentRetryWait = 30 * time.Second
	inventoryInterval   = 10 * time.Second
)

var (
	debugMode       = flag.Bool("debug", false, "run in console mode for debugging")
	enrollmentToken = flag.String("token", "", "enrollment token for debug when registry value is empty")
)

func main() {
	flag.Parse()

	if err := run(); err != nil {
		log.Fatalf("%s: %v", serviceName, err)
	}
}

func run() error {
	cfg := config.LoadConfig(*enrollmentToken)
	apiClient := api.NewAPIClient(cfg)

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

	if err := performHandshake(&s.cfg, s.apiClient, stopCh); err != nil {
		log.Printf("handshake failed: %v", err)
		status <- svc.Status{State: svc.Stopped}
		return false, 0
	}

	go runAgentLoop(stopCh, &s.cfg, s.apiClient)

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

			info, err := system.CollectInfo()
			if err != nil {
				log.Printf("inventory collection failed: %v", err)
				continue
			}

			payload, err := json.Marshal(info)
			if err != nil {
				log.Printf("inventory marshal failed: %v", err)
				continue
			}

			log.Printf("inventory payload: %s", string(payload))

			if err := apiClient.SendInventory(cfg.AuthToken, cfg.HardwareID, info); err != nil {
				if errors.Is(err, api.ErrUnauthorized) {
					log.Printf("inventory upload unauthorized, clearing auth token for re-enrollment")
					if clearErr := config.ClearAuthToken(); clearErr != nil {
						log.Printf("failed to clear auth token: %v", clearErr)
					}
					cfg.AuthToken = ""
					continue
				}

				log.Printf("inventory upload failed: %v", err)
				continue
			}

			log.Printf("inventory upload succeeded")
		}
	}
}
