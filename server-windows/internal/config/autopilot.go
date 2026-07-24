package config

import "os"

const defaultAutopilotAdminUser = "Admin"

// AutopilotAdminDefaults returns env-based defaults for local admin provisioning.
func AutopilotAdminDefaults() (username, password string) {
	username = os.Getenv("AUTOPILOT_ADMIN_USER")
	if username == "" {
		username = defaultAutopilotAdminUser
	}
	password = os.Getenv("AUTOPILOT_ADMIN_PASS")
	return username, password
}

// EnrollmentSecretDefault returns the env-based default bootstrap enrollment secret.
func EnrollmentSecretDefault() string {
	return os.Getenv("ENROLLMENT_SECRET")
}
