package main

import (
	"log"
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
			windows.POST("/enroll", windowsHandler.Enroll)
			windows.POST("/inventory", windowsHandler.Inventory)
		}
	}

	log.Printf("server-windows listening on %s", listenAddr)
	if err := router.Run(listenAddr); err != nil {
		log.Fatal(err)
	}
}
