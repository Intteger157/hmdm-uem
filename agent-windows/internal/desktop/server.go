package desktop

import (
	"bytes"
	"context"
	_ "embed"
	"html/template"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/agentstate"
	"github.com/hmdm/agent-windows/internal/config"
)

//go:embed page.html
var pageTemplateContent string

var pageTemplate = template.Must(template.New("page").Parse(pageTemplateContent))

type pageData struct {
	Hostname     string
	ServerURL    string
	AgentVersion string
	LastSync     string
	DeviceID     string
}

// Run starts the loopback device information HTTP server until stop is closed.
func Run(stop <-chan struct{}, cfg *config.Config) {
	mux := http.NewServeMux()
	provider := func() pageData {
		return buildPageData(cfg)
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		renderPage(w, provider())
	})

	server := &http.Server{
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(LocalHost, LocalPort))
	if err != nil {
		log.Printf("desktop info server: listen failed: %v", err)
		return
	}

	go func() {
		log.Printf("desktop info server listening on %s", LocalURL())
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("desktop info server: %v", err)
		}
	}()

	go func() {
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Printf("desktop info server shutdown: %v", err)
		}
	}()
}

func buildPageData(cfg *config.Config) pageData {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "Unknown"
	}

	serverURL := "Not configured"
	if cfg != nil && strings.TrimSpace(cfg.ServerURL) != "" {
		serverURL = strings.TrimSpace(cfg.ServerURL)
	}

	deviceID := "Unknown"
	if state, err := agentstate.Load(); err == nil && strings.TrimSpace(state.DeviceID) != "" {
		deviceID = strings.TrimSpace(state.DeviceID)
	}

	return pageData{
		Hostname:     strings.TrimSpace(hostname),
		ServerURL:    serverURL,
		AgentVersion: AgentVersion,
		LastSync:     loadLastSyncDisplay(),
		DeviceID:     deviceID,
	}
}

func renderPage(w http.ResponseWriter, data pageData) {
	var buf bytes.Buffer
	if err := pageTemplate.Execute(&buf, data); err != nil {
		http.Error(w, "failed to render page", http.StatusInternalServerError)
		log.Printf("desktop info server: render page: %v", err)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(buf.Bytes())
}
