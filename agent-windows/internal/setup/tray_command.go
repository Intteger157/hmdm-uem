package setup

import (
	"fmt"
	"path/filepath"
)

// TrayRunCommand builds the Run registry value for the tray helper.
func TrayRunCommand(exePath string) string {
	return fmt.Sprintf(`"%s" -tray`, filepath.Clean(exePath))
}
