//go:build windows

// One-off helper: go run ./cmd/inventory-test
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/hmdm/agent-windows/internal/system"
)

func main() {
	info, err := system.CollectInfo()
	if err != nil {
		fmt.Fprintf(os.Stderr, "collect failed: %v\n", err)
		os.Exit(1)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(info); err != nil {
		fmt.Fprintf(os.Stderr, "encode failed: %v\n", err)
		os.Exit(1)
	}
}
