//go:build windows

package system

import (
	"encoding/json"
	"os/exec"
	"strings"
	"syscall"
)

const collectProfileUsersScript = `$ErrorActionPreference = 'SilentlyContinue'; Get-CimInstance Win32_UserProfile | Where-Object { $_.Special -eq $false } | ForEach-Object { try { $sid = New-Object System.Security.Principal.SecurityIdentifier($_.SID); $name = $sid.Translate([System.Security.Principal.NTAccount]).Value; [PSCustomObject]@{ Username = $name; Status = 'active' } } catch {} } | ConvertTo-Json -Compress`

type profileUserEntry struct {
	Username string `json:"Username"`
	Status   string `json:"Status"`
}

func collectProfileUsers(adminUsers map[string]bool) []LocalUserInfo {
	output, err := runProfileUsersScript()
	if err != nil {
		return nil
	}

	entries, err := parseProfileUsersJSON(output)
	if err != nil {
		return nil
	}

	users := make([]LocalUserInfo, 0, len(entries))
	for _, entry := range entries {
		username := strings.TrimSpace(entry.Username)
		if !shouldIncludeProfileUser(username) {
			continue
		}

		status := normalizeProfileUserStatus(entry.Status)
		users = append(users, LocalUserInfo{
			Username: username,
			IsAdmin:  isAdminUsername(username, adminUsers),
			Status:   status,
		})
	}
	return users
}

func runProfileUsersScript() ([]byte, error) {
	cmd := exec.Command(
		"powershell.exe",
		"-NoProfile",
		"-NonInteractive",
		"-ExecutionPolicy", "Bypass",
		"-Command", collectProfileUsersScript,
	)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return cmd.Output()
}

func parseProfileUsersJSON(raw []byte) ([]profileUserEntry, error) {
	text := strings.TrimSpace(string(raw))
	if text == "" || text == "null" {
		return nil, nil
	}

	if strings.HasPrefix(text, "[") {
		var entries []profileUserEntry
		if err := json.Unmarshal(raw, &entries); err != nil {
			return nil, err
		}
		return entries, nil
	}

	var single profileUserEntry
	if err := json.Unmarshal(raw, &single); err != nil {
		return nil, err
	}
	return []profileUserEntry{single}, nil
}

func shouldIncludeProfileUser(username string) bool {
	username = strings.TrimSpace(username)
	if username == "" {
		return false
	}
	if strings.HasSuffix(username, "$") {
		return false
	}
	lower := strings.ToLower(username)
	if strings.HasPrefix(lower, "nt authority\\") || strings.HasPrefix(lower, "window manager\\") {
		return false
	}
	return normalizeInteractiveUsername(username) != "" || strings.Contains(username, `\`)
}

func normalizeProfileUserStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "locked":
		return "locked"
	case "disabled":
		return "disabled"
	default:
		return "active"
	}
}

func isAdminUsername(username string, adminUsers map[string]bool) bool {
	if adminUsers == nil {
		return false
	}
	if adminUsers[username] {
		return true
	}
	if idx := strings.LastIndex(username, `\`); idx >= 0 {
		if adminUsers[username[idx+1:]] {
			return true
		}
	}
	return false
}

func mergeLocalUsers(primary, secondary []LocalUserInfo) []LocalUserInfo {
	merged := make(map[string]LocalUserInfo, len(primary)+len(secondary))

	for _, user := range primary {
		key := usernameDedupeKey(user.Username)
		if key == "" {
			continue
		}
		merged[key] = user
	}

	for _, user := range secondary {
		key := usernameDedupeKey(user.Username)
		if key == "" {
			continue
		}
		existing, ok := merged[key]
		if !ok {
			merged[key] = user
			continue
		}
		if user.IsAdmin {
			existing.IsAdmin = true
		}
		if existing.Status == "" || existing.Status == "active" {
			if user.Status != "" && user.Status != "active" {
				existing.Status = user.Status
			}
		}
		if shouldPreferUsername(existing.Username, user.Username) {
			existing.Username = user.Username
		}
		merged[key] = existing
	}

	result := make([]LocalUserInfo, 0, len(merged))
	for _, user := range merged {
		result = append(result, user)
	}
	return sortLocalUsers(result)
}

func usernameDedupeKey(username string) string {
	username = strings.ToLower(strings.TrimSpace(username))
	if username == "" {
		return ""
	}
	if idx := strings.LastIndex(username, `\`); idx >= 0 && idx+1 < len(username) {
		return username[idx+1:]
	}
	return username
}

func normalizeUsernameKey(username string) string {
	return usernameDedupeKey(username)
}

func shouldPreferUsername(current, candidate string) bool {
	current = strings.TrimSpace(current)
	candidate = strings.TrimSpace(candidate)
	if strings.Contains(candidate, `\`) && !strings.Contains(current, `\`) {
		return true
	}
	return len(candidate) > len(current)
}

func sortLocalUsers(users []LocalUserInfo) []LocalUserInfo {
	if len(users) < 2 {
		return users
	}

	sorted := append([]LocalUserInfo(nil), users...)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if strings.ToLower(sorted[j].Username) < strings.ToLower(sorted[i].Username) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	return sorted
}
