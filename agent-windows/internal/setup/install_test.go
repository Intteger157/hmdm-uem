package setup

import (
	"testing"
)

func TestTrayRunCommand(t *testing.T) {
	t.Parallel()

	got := TrayRunCommand(`C:\Program Files\Singularity MDM Agent\singularity-agent.exe`)
	want := `"C:\Program Files\Singularity MDM Agent\singularity-agent.exe" -tray`
	if got != want {
		t.Fatalf("TrayRunCommand() = %q, want %q", got, want)
	}
}
