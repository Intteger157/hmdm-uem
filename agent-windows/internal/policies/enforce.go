//go:build windows

package policies

import "fmt"

// EnforcePolicies applies all MVP policies from the effective payload.
func EnforcePolicies(payload Payload) []Result {
	results := make([]Result, 0, 4)
	results = append(results, enforceDefender(payload.DefenderEnabled))
	results = append(results, enforceUSBBlock(payload.BlockUsbStorage))
	results = append(results, enforceUsbReadOnly(payload.UsbReadOnly))
	results = append(results, enforceScreenLockTimeout(payload.ScreenLockTimeout))
	return results
}

// NeedsEnforcement reports whether the desired payload differs from the last applied policy.
func NeedsEnforcement(desired Payload) (bool, error) {
	applied, err := LoadAppliedPolicy()
	if err != nil {
		return true, err
	}
	if applied.EnforcedAt == "" {
		return true, nil
	}
	return !EqualPayload(desired, applied.Payload), nil
}

// IsCompliant checks whether the current machine state matches the desired payload.
func IsCompliant(desired Payload) (bool, []Result) {
	results := make([]Result, 0, 4)

	defenderEnabled, err := readDefenderEnabled()
	if err != nil {
		results = append(results, Result{Name: "Defender", Success: false, Message: err.Error()})
	} else if desired.DefenderEnabled {
		if defenderEnabled != desired.DefenderEnabled {
			results = append(results, Result{
				Name:    "Defender",
				Success: false,
				Message: fmt.Sprintf("expected realtime monitoring %v, found %v", desired.DefenderEnabled, defenderEnabled),
			})
		} else {
			results = append(results, Result{Name: "Defender", Success: true, Message: "compliant"})
		}
	} else if hasDefenderPolicyKeys() {
		results = append(results, Result{
			Name:    "Defender",
			Success: false,
			Message: "expected policy keys removed, found Windows Defender policy registry entries",
		})
	} else {
		results = append(results, Result{Name: "Defender", Success: true, Message: "compliant"})
	}

	usbBlocked, err := readUSBBlocked()
	if err != nil {
		results = append(results, Result{Name: "USB", Success: false, Message: err.Error()})
	} else if desired.BlockUsbStorage {
		if usbBlocked != desired.BlockUsbStorage {
			results = append(results, Result{
				Name:    "USB",
				Success: false,
				Message: fmt.Sprintf("expected block %v, found %v", desired.BlockUsbStorage, usbBlocked),
			})
		} else {
			results = append(results, Result{Name: "USB", Success: true, Message: "compliant"})
		}
	} else if usbPolicyKeysPresent() {
		results = append(results, Result{
			Name:    "USB",
			Success: false,
			Message: "expected removable storage policy key removed, but registry tattoo remains",
		})
	} else {
		results = append(results, Result{Name: "USB", Success: true, Message: "compliant"})
	}

	usbReadOnly, err := readUsbReadOnly()
	if err != nil {
		results = append(results, Result{Name: "USB Read-Only", Success: false, Message: err.Error()})
	} else if usbReadOnly != desired.UsbReadOnly {
		results = append(results, Result{
			Name:    "USB Read-Only",
			Success: false,
			Message: fmt.Sprintf("expected read-only %v, found %v", desired.UsbReadOnly, usbReadOnly),
		})
	} else {
		results = append(results, Result{Name: "USB Read-Only", Success: true, Message: "compliant"})
	}

	currentTimeout, err := readScreenLockTimeout()
	if err != nil {
		results = append(results, Result{Name: "ScreenLock", Success: false, Message: err.Error()})
	} else if currentTimeout != desired.ScreenLockTimeout {
		results = append(results, Result{
			Name:    "ScreenLock",
			Success: false,
			Message: fmt.Sprintf("expected timeout %d min, found %d min", desired.ScreenLockTimeout, currentTimeout),
		})
	} else {
		results = append(results, Result{Name: "ScreenLock", Success: true, Message: "compliant"})
	}

	for _, result := range results {
		if !result.Success {
			return false, results
		}
	}
	return true, results
}

// ApplyIfNeeded enforces policies when desired differs from applied state.
func ApplyIfNeeded(desired Payload) ([]Result, bool, error) {
	needs, err := NeedsEnforcement(desired)
	if err != nil {
		return nil, false, err
	}
	if !needs {
		return nil, false, nil
	}

	results := EnforcePolicies(desired)
	output, success := formatResults(results)
	if !success {
		return results, true, fmt.Errorf("policy enforcement failed: %s", output)
	}

	if err := SaveAppliedPolicy(desired); err != nil {
		return results, true, fmt.Errorf("save applied policy: %w", err)
	}
	return results, true, nil
}

// ReconcileCompliance re-applies policies when local state drifted from desired configuration.
func ReconcileCompliance(desired Payload) ([]Result, bool, error) {
	compliant, checkResults := IsCompliant(desired)
	if compliant {
		return checkResults, false, nil
	}

	results := EnforcePolicies(desired)
	output, success := formatResults(results)
	if !success {
		return results, true, fmt.Errorf("policy reconciliation failed: %s", output)
	}

	if err := SaveAppliedPolicy(desired); err != nil {
		return results, true, fmt.Errorf("save applied policy: %w", err)
	}
	return results, true, nil
}

func FormatResults(results []Result) (string, bool) {
	return formatResults(results)
}
