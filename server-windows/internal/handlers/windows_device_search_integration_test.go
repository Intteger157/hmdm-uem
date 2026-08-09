package handlers

import (
	"testing"
	"time"

	"github.com/hmdm/server-windows/internal/models"
	"github.com/hmdm/server-windows/internal/testsupport"
)

func TestApplyWindowsDeviceSearchCaseInsensitiveCurrentUser(t *testing.T) {
	database := testsupport.OpenSchema(t, "windows_device_search")
	if err := database.AutoMigrate(&models.WindowsDevice{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	device := models.WindowsDevice{
		HardwareID:  "search-test-hw-1",
		Hostname:    "DESKTOP-TEST",
		CurrentUser: `AzureAD\AlyonaEvseeva`,
		LastCheckin: time.Now().UTC(),
		AgentStatus: models.AgentStatusActive,
	}
	if err := database.Create(&device).Error; err != nil {
		t.Fatalf("Create device: %v", err)
	}

	for _, query := range []string{"alyo", "ALYO", "Alyona", "azuread"} {
		t.Run(query, func(t *testing.T) {
			var results []models.WindowsDevice
			searchQuery := database.Model(&models.WindowsDevice{})
			searchQuery = applyWindowsDeviceSearch(searchQuery, query)
			if err := searchQuery.Find(&results).Error; err != nil {
				t.Fatalf("Find: %v", err)
			}
			if len(results) != 1 {
				t.Fatalf("query %q: got %d devices, want 1", query, len(results))
			}
			if results[0].HardwareID != device.HardwareID {
				t.Fatalf("query %q: matched %q, want %q", query, results[0].HardwareID, device.HardwareID)
			}
		})
	}
}

func TestApplyWindowsDeviceSearchCaseInsensitiveHostname(t *testing.T) {
	database := testsupport.OpenSchema(t, "windows_device_search_hostname")
	if err := database.AutoMigrate(&models.WindowsDevice{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}

	device := models.WindowsDevice{
		HardwareID:  "search-test-hw-2",
		Hostname:    "Finance-Laptop-01",
		CurrentUser: "local\\user",
		LastCheckin: time.Now().UTC(),
		AgentStatus: models.AgentStatusActive,
	}
	if err := database.Create(&device).Error; err != nil {
		t.Fatalf("Create device: %v", err)
	}

	var results []models.WindowsDevice
	searchQuery := database.Model(&models.WindowsDevice{})
	searchQuery = applyWindowsDeviceSearch(searchQuery, "finance")
	if err := searchQuery.Find(&results).Error; err != nil {
		t.Fatalf("Find: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("got %d devices, want 1", len(results))
	}
}
