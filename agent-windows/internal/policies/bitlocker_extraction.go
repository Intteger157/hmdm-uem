package policies

import (
	"regexp"
	"strings"
)

const (
	bitLockerRecoveryKeyPrefix   = "RECOVERY_KEY:"
	bitLockerRebootRequiredNote  = "Success (Reboot Required)"
	bitLockerPendingRebootNote   = "Pending Reboot"
)

var (
	bitLockerRecoveryKeyPattern = regexp.MustCompile(`\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b`)
	bitLockerRebootRequiredCodes  = []string{
		"0x8031004e",
		"must restart your computer",
		"restart your computer before",
	}
)

type bitLockerEnableOutcome struct {
	RecoveryKey    string
	RebootRequired bool
	CommandFailed  bool
	CommandError   string
}

func extractBitLockerRecoveryKeyFromOutput(output string) string {
	match := bitLockerRecoveryKeyPattern.FindString(output)
	return strings.TrimSpace(match)
}

func isBitLockerRebootRequired(output string, err error) bool {
	lower := strings.ToLower(output)
	for _, marker := range bitLockerRebootRequiredCodes {
		if strings.Contains(lower, strings.ToLower(marker)) {
			return true
		}
	}
	if err != nil {
		errText := strings.ToLower(err.Error())
		for _, marker := range bitLockerRebootRequiredCodes {
			if strings.Contains(errText, strings.ToLower(marker)) {
				return true
			}
		}
	}
	return false
}

func evaluateBitLockerEnableOutput(output string, err error) bitLockerEnableOutcome {
	outcome := bitLockerEnableOutcome{
		RecoveryKey:    extractBitLockerRecoveryKeyFromOutput(output),
		RebootRequired: isBitLockerRebootRequired(output, err),
	}
	if err != nil {
		outcome.CommandFailed = true
		outcome.CommandError = strings.TrimSpace(err.Error())
		if outcome.CommandError == "" {
			outcome.CommandError = strings.TrimSpace(output)
		}
	}
	return outcome
}

func buildBitLockerEnableResult(outcome bitLockerEnableOutcome) Result {
	if outcome.RecoveryKey != "" {
		message := bitLockerRecoveryKeyPrefix + outcome.RecoveryKey
		if outcome.RebootRequired {
			return Result{
				Name:    "BitLocker",
				Success: true,
				Message: message + "; " + bitLockerRebootRequiredNote,
			}
		}
		if outcome.CommandFailed {
			return Result{
				Name:    "BitLocker",
				Success: true,
				Message: message + "; encryption command reported an error after key generation",
			}
		}
		return Result{
			Name:    "BitLocker",
			Success: true,
			Message: message,
		}
	}

	if outcome.RebootRequired {
		return Result{
			Name:    "BitLocker",
			Success: true,
			Message: bitLockerPendingRebootNote + ": reboot required to continue BitLocker encryption",
		}
	}

	if outcome.CommandFailed {
		return Result{
			Name:    "BitLocker",
			Success: false,
			Message: "enable failed: " + outcome.CommandError,
		}
	}

	return Result{
		Name:    "BitLocker",
		Success: false,
		Message: "BitLocker started but recovery key was not returned",
	}
}

func extractRecoveryKeyFromResultMessage(message string) string {
	if strings.HasPrefix(message, bitLockerRecoveryKeyPrefix) {
		remainder := strings.TrimPrefix(message, bitLockerRecoveryKeyPrefix)
		if idx := strings.Index(remainder, ";"); idx >= 0 {
			remainder = remainder[:idx]
		}
		return strings.TrimSpace(remainder)
	}
	return extractBitLockerRecoveryKeyFromOutput(message)
}

func ExtractBitLockerRecoveryKey(results []Result) string {
	for _, result := range results {
		if result.Name != "BitLocker" {
			continue
		}
		if key := extractRecoveryKeyFromResultMessage(result.Message); key != "" {
			return key
		}
	}
	return ""
}

func sanitizeResultMessage(message string) string {
	if strings.HasPrefix(message, bitLockerRecoveryKeyPrefix) {
		if strings.Contains(message, bitLockerRebootRequiredNote) {
			return "recovery key escrowed; reboot required"
		}
		return "recovery key escrowed"
	}
	return message
}
