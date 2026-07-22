//go:build windows

package system

import (
	"fmt"
	"os/user"
	"strings"
	"time"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows/registry"
)

type LocalUserInfo struct {
	Username string `json:"username"`
	IsAdmin  bool   `json:"is_admin"`
	Status   string `json:"status"`
}

type InstalledSoftwareInfo struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Publisher   string `json:"publisher"`
	InstallDate string `json:"install_date"`
}

type win32ComputerSystem struct {
	Manufacturer string
	Model        string
}

type win32BIOS struct {
	SerialNumber string
}

type win32ComputerSystemProduct struct {
	IdentifyingNumber string
	Name              string
	Vendor            string
}

type win32SystemEnclosure struct {
	SerialNumber string
}

type win32UserAccount struct {
	Name     string
	Disabled bool
	Lockout  bool
}

type win32GroupUser struct {
	GroupComponent string
	PartComponent  string
}

const maxInstalledSoftwareEntries = 150

func collectExtendedInventory() (manufacturer, model, serialNumber, currentUser string, localUsers []LocalUserInfo, installedSoftware []InstalledSoftwareInfo, err error) {
	manufacturer, model = collectSystemProduct()
	serialNumber = collectSerialNumber()
	currentUser = collectCurrentUser()
	localUsers = collectLocalUsers()
	installedSoftware = collectInstalledSoftware()
	return manufacturer, model, serialNumber, currentUser, localUsers, installedSoftware, nil
}

func collectSystemProduct() (manufacturer, model string) {
	var systems []win32ComputerSystem
	if err := wmi.Query("SELECT Manufacturer, Model FROM Win32_ComputerSystem", &systems); err == nil && len(systems) > 0 {
		manufacturer = strings.TrimSpace(systems[0].Manufacturer)
		model = strings.TrimSpace(systems[0].Model)
	}

	if isGenericModel(model) {
		var products []win32ComputerSystemProduct
		if err := wmi.Query("SELECT Name, Vendor FROM Win32_ComputerSystemProduct", &products); err == nil && len(products) > 0 {
			if name := strings.TrimSpace(products[0].Name); name != "" && !isGenericModel(name) {
				model = name
			}
			if manufacturer == "" {
				manufacturer = strings.TrimSpace(products[0].Vendor)
			}
		}

		var boards []win32BaseBoard
		if err := wmi.Query("SELECT Product, Manufacturer FROM Win32_BaseBoard", &boards); err == nil && len(boards) > 0 {
			if product := strings.TrimSpace(boards[0].Product); product != "" && !isGenericModel(product) {
				model = product
			}
			if manufacturer == "" {
				manufacturer = strings.TrimSpace(boards[0].Manufacturer)
			}
		}
	}

	return manufacturer, model
}

func isGenericModel(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "system product name", "default string", "to be filled by o.e.m.", "product name":
		return true
	default:
		return false
	}
}

func collectSerialNumber() string {
	candidates := []func() string{
		collectSerialFromComputerSystemProduct,
		collectSerialFromBaseBoard,
		collectSerialFromSystemEnclosure,
		collectSerialFromBIOS,
	}

	for _, source := range candidates {
		if serial := source(); serial != "" {
			return serial
		}
	}
	return ""
}

func collectSerialFromComputerSystemProduct() string {
	var products []win32ComputerSystemProduct
	if err := wmi.Query("SELECT IdentifyingNumber FROM Win32_ComputerSystemProduct", &products); err != nil {
		return ""
	}
	for _, product := range products {
		if serial := normalizeSerial(product.IdentifyingNumber); serial != "" {
			return serial
		}
	}
	return ""
}

func collectSerialFromBaseBoard() string {
	var boards []win32BaseBoard
	if err := wmi.Query("SELECT SerialNumber FROM Win32_BaseBoard", &boards); err != nil {
		return ""
	}
	for _, board := range boards {
		if serial := normalizeSerial(board.SerialNumber); serial != "" {
			return serial
		}
	}
	return ""
}

func collectSerialFromSystemEnclosure() string {
	var enclosures []win32SystemEnclosure
	if err := wmi.Query("SELECT SerialNumber FROM Win32_SystemEnclosure", &enclosures); err != nil {
		return ""
	}
	for _, enclosure := range enclosures {
		if serial := normalizeSerial(enclosure.SerialNumber); serial != "" {
			return serial
		}
	}
	return ""
}

func collectSerialFromBIOS() string {
	var biosEntries []win32BIOS
	if err := wmi.Query("SELECT SerialNumber FROM Win32_BIOS", &biosEntries); err != nil {
		return ""
	}
	for _, entry := range biosEntries {
		if serial := normalizeSerial(entry.SerialNumber); serial != "" {
			return serial
		}
	}
	return ""
}

func normalizeSerial(raw string) string {
	serial := strings.TrimSpace(raw)
	if serial == "" {
		return ""
	}
	lower := strings.ToLower(serial)
	switch lower {
	case "to be filled by o.e.m.", "default string", "system serial number", "none", "0", "0123456789", "123456789":
		return ""
	}
	return serial
}

func collectCurrentUser() string {
	current, err := user.Current()
	if err != nil {
		return ""
	}
	if current.Username != "" {
		return current.Username
	}
	return strings.TrimSpace(current.Name)
}

func collectLocalUsers() []LocalUserInfo {
	var accounts []win32UserAccount
	if err := wmi.Query("SELECT Name, Disabled, Lockout FROM Win32_UserAccount WHERE LocalAccount=TRUE", &accounts); err != nil {
		return nil
	}

	adminUsers := collectAdministratorUsernames()
	users := make([]LocalUserInfo, 0, len(accounts))
	for _, account := range accounts {
		name := strings.TrimSpace(account.Name)
		if name == "" {
			continue
		}

		status := "active"
		switch {
		case account.Lockout:
			status = "locked"
		case account.Disabled:
			status = "disabled"
		}

		users = append(users, LocalUserInfo{
			Username: name,
			IsAdmin:  adminUsers[name],
			Status:   status,
		})
	}
	return users
}

func collectAdministratorUsernames() map[string]bool {
	admins := make(map[string]bool)
	var groupUsers []win32GroupUser
	if err := wmi.Query("SELECT GroupComponent, PartComponent FROM Win32_GroupUser", &groupUsers); err != nil {
		return admins
	}

	for _, entry := range groupUsers {
		if !strings.Contains(entry.GroupComponent, `Name="Administrators"`) {
			continue
		}
		username := extractWMIComponentName(entry.PartComponent)
		if username != "" {
			admins[username] = true
		}
	}
	return admins
}

func extractWMIComponentName(component string) string {
	const marker = `Name="`
	start := strings.Index(component, marker)
	if start < 0 {
		return ""
	}
	start += len(marker)
	end := strings.Index(component[start:], `"`)
	if end < 0 {
		return ""
	}
	return component[start : start+end]
}

func collectInstalledSoftware() []InstalledSoftwareInfo {
	seen := make(map[string]struct{})
	items := make([]InstalledSoftwareInfo, 0, 64)

	for _, root := range []registry.Key{
		registry.LOCAL_MACHINE,
	} {
		for _, path := range []string{
			`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
			`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
		} {
			appendSoftwareFromRegistry(root, path, seen, &items)
			if len(items) >= maxInstalledSoftwareEntries {
				return items
			}
		}
	}

	return items
}

func appendSoftwareFromRegistry(root registry.Key, path string, seen map[string]struct{}, items *[]InstalledSoftwareInfo) {
	key, err := registry.OpenKey(root, path, registry.ENUMERATE_SUB_KEYS|registry.QUERY_VALUE)
	if err != nil {
		return
	}
	defer key.Close()

	names, err := key.ReadSubKeyNames(-1)
	if err != nil {
		return
	}

	for _, subKeyName := range names {
		if len(*items) >= maxInstalledSoftwareEntries {
			return
		}

		subKey, err := registry.OpenKey(key, subKeyName, registry.QUERY_VALUE)
		if err != nil {
			continue
		}

		displayName, _, err := subKey.GetStringValue("DisplayName")
		if err != nil || strings.TrimSpace(displayName) == "" {
			subKey.Close()
			continue
		}

		systemComponent, _, _ := subKey.GetIntegerValue("SystemComponent")
		if systemComponent == 1 {
			subKey.Close()
			continue
		}

		version, _, _ := subKey.GetStringValue("DisplayVersion")
		publisher, _, _ := subKey.GetStringValue("Publisher")
		installDate := formatInstallDate(subKey)

		dedupeKey := strings.ToLower(strings.TrimSpace(displayName) + "|" + strings.TrimSpace(version))
		if _, exists := seen[dedupeKey]; exists {
			subKey.Close()
			continue
		}
		seen[dedupeKey] = struct{}{}

		*items = append(*items, InstalledSoftwareInfo{
			Name:        strings.TrimSpace(displayName),
			Version:     strings.TrimSpace(version),
			Publisher:   strings.TrimSpace(publisher),
			InstallDate: installDate,
		})
		subKey.Close()
	}
}

func formatInstallDate(key registry.Key) string {
	raw, _, err := key.GetStringValue("InstallDate")
	if err != nil || len(raw) != 8 {
		return "—"
	}
	parsed, err := time.Parse("20060102", raw)
	if err != nil {
		return raw
	}
	return parsed.Format("2006-01-02")
}

func formatModelLabel(manufacturer, model string) string {
	manufacturer = strings.TrimSpace(manufacturer)
	model = strings.TrimSpace(model)
	switch {
	case manufacturer != "" && model != "":
		return fmt.Sprintf("%s %s", manufacturer, model)
	case model != "":
		return model
	case manufacturer != "":
		return manufacturer
	default:
		return ""
	}
}
