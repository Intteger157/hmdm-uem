package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/handlers"
)

const defaultDSN = "host=localhost user=postgres password=postgres dbname=hmdm port=5432 sslmode=disable"

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = defaultDSN
	}

	if _, err := db.InitDB(dsn); err != nil {
		log.Fatalf("database init failed: %v", err)
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

	log.Println("server-windows listening on :8081")
	if err := router.Run(":8081"); err != nil {
		log.Fatal(err)
	}
}
