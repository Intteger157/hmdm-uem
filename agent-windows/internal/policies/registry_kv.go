//go:build windows

package policies

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/sys/windows/registry"
)

type parsedRegistryPath struct {
	root      registry.Key
	keyPath   string
	valueName string
}

func parseRegistryPolicyPath(policyPath string) (parsedRegistryPath, error) {
	normalized := strings.ReplaceAll(strings.TrimSpace(policyPath), "/", `\`)
	parts := strings.Split(normalized, `\`)
	if len(parts) < 3 {
		return parsedRegistryPath{}, errors.New("policy path must include hive, key path, and value name")
	}

	hive := strings.ToUpper(strings.TrimSpace(parts[0]))
	var root registry.Key
	switch hive {
	case "HKLM", "HKEY_LOCAL_MACHINE":
		root = registry.LOCAL_MACHINE
	case "HKCU", "HKEY_CURRENT_USER":
		root = registry.CURRENT_USER
	default:
		return parsedRegistryPath{}, fmt.Errorf("unsupported registry hive: %s", parts[0])
	}

	valueName := strings.TrimSpace(parts[len(parts)-1])
	if valueName == "" {
		return parsedRegistryPath{}, errors.New("registry value name is required")
	}

	keyPath := strings.Join(parts[1:len(parts)-1], `\`)
	if strings.TrimSpace(keyPath) == "" {
		return parsedRegistryPath{}, errors.New("registry key path is required")
	}

	return parsedRegistryPath{
		root:      root,
		keyPath:   keyPath,
		valueName: valueName,
	}, nil
}

func applyRegistryPolicy(policy RegistryPolicy) Result {
	name := strings.TrimSpace(policy.PolicyPath)
	if name == "" {
		return Result{Name: "Registry", Success: false, Message: "policy path is required"}
	}

	parsed, err := parseRegistryPolicyPath(name)
	if err != nil {
		return Result{Name: name, Success: false, Message: err.Error()}
	}

	if err := setRegistryValue(parsed, policy.ValueType, policy.Value); err != nil {
		return Result{Name: name, Success: false, Message: err.Error()}
	}

	return Result{Name: name, Success: true, Message: "Applied"}
}

func setRegistryValue(parsed parsedRegistryPath, valueType, rawValue string) error {
	key, _, err := registry.CreateKey(parsed.root, parsed.keyPath, registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("open registry key: %w", err)
	}
	defer key.Close()

	switch strings.ToUpper(strings.TrimSpace(valueType)) {
	case "DWORD":
		parsedValue, parseErr := parseDwordValue(rawValue)
		if parseErr != nil {
			return parseErr
		}
		return key.SetDWordValue(parsed.valueName, parsedValue)
	case "EXPANDSTRING":
		return key.SetExpandStringValue(parsed.valueName, rawValue)
	case "MULTISTRING":
		return key.SetStringsValue(parsed.valueName, parseMultiStringValue(rawValue))
	case "BINARY":
		data, decodeErr := decodeBinaryValue(rawValue)
		if decodeErr != nil {
			return decodeErr
		}
		return key.SetBinaryValue(parsed.valueName, data)
	default:
		return key.SetStringValue(parsed.valueName, rawValue)
	}
}

func parseDwordValue(rawValue string) (uint32, error) {
	trimmed := strings.TrimSpace(rawValue)
	if trimmed == "" {
		return 0, errors.New("DWORD value is required")
	}

	if strings.HasPrefix(strings.ToLower(trimmed), "0x") {
		parsed, err := strconv.ParseUint(trimmed[2:], 16, 32)
		if err != nil {
			return 0, fmt.Errorf("invalid DWORD hex value: %w", err)
		}
		return uint32(parsed), nil
	}

	parsed, err := strconv.ParseUint(trimmed, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("invalid DWORD value: %w", err)
	}
	return uint32(parsed), nil
}

func parseMultiStringValue(rawValue string) []string {
	normalized := strings.ReplaceAll(rawValue, "\r\n", "\n")
	parts := strings.Split(normalized, "\n")
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		values = append(values, trimmed)
	}
	if len(values) == 0 {
		return []string{""}
	}
	return values
}

func decodeBinaryValue(rawValue string) ([]byte, error) {
	trimmed := strings.TrimSpace(rawValue)
	if trimmed == "" {
		return nil, errors.New("binary value is required")
	}
	trimmed = strings.ReplaceAll(trimmed, " ", "")
	trimmed = strings.ReplaceAll(trimmed, ":", "")
	data, err := hex.DecodeString(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid binary hex value: %w", err)
	}
	return data, nil
}
