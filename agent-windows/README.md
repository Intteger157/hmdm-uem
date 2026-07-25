# Singularity MDM Windows Agent

One Go codebase produces two distribution formats with **identical functionality**:

| Artifact | Path | Purpose |
|----------|------|---------|
| **Autopilot EXE** | `deploy/volumes/files/singularity-autopilot/singularity-agent.exe` | Bootstrap / zero-touch enrollment (`GET /rest/windows/enroll`) |
| **Distribution MSI** | `agent-windows/installer/dist/singularity-agent.msi` | Manual install (USB, GPO, file share, Java `/files/` upload) |

Both artifacts use the same binary and install to the same locations:

- `C:\Program Files\Singularity MDM Agent\singularity-agent.exe`
- `C:\ProgramData\Singularity MDM Agent\` (state and config cache)
- `HKLM\SOFTWARE\Singularity MDM\Agent` (server URL, enrollment token, auth token)

When you add agent features, rebuild **both** artifacts from the same source.

Icons:

- `icon.ico` — embedded into the binary for the **system tray** (`go:embed` + `systray.SetIcon`)
- `rsrc.syso` — generated at build time so **Explorer / Task Manager** show the same icon on the `.exe`

After replacing `icon.ico`, rerun `build-agent.ps1` (tray and file icon update together).

## Build (Windows)

Prerequisites: Go 1.25+, WiX v4 (`dotnet tool install --global wix`).

1. Open **Devices → Windows → Add device** in the MDM console.
2. Copy the org enrollment secret (`win-enroll-org-...`).
3. From repo root:

```powershell
.\agent-windows\build-agent.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-org-5282347fbbb415157568466115938efd" `
  -Msi
```

This builds `singularity-agent.exe` once, publishes it to the autopilot folder, and packages `singularity-agent.msi`.

Autopilot-only (no MSI):

```powershell
.\agent-windows\build-agent.ps1
```

MSI-only (reuse staging binary from a previous build):

```powershell
.\agent-windows\installer\build-msi.ps1 -ServerUrl "..." -Token "..." -SkipBuild
```

## Service name

The Windows service is `SingularityMDMAgent`. The on-disk binary is always `singularity-agent.exe`.

Install location: `C:\Program Files\Singularity MDM Agent\singularity-agent.exe`  
Data directory: `C:\ProgramData\Singularity MDM Agent\`  
Registry settings: `HKLM\SOFTWARE\Singularity MDM\Agent`

## Debug logs (console)

Run PowerShell **as Administrator**, stop the service, then start the agent in console mode:

```powershell
Stop-Service SingularityMDMAgent
cd "C:\Program Files\Singularity MDM Agent"
.\singularity-agent.exe -debug
```

If the service cannot be stopped, the debug instance may fail to write `state.json` while the service (LocalSystem) is still running.

After debugging:

```powershell
Start-Service SingularityMDMAgent
```

## Device information page

The tray helper menu item **Device Information** opens a public page on the MDM server at `{ServerURL}/device-info/{DeviceID}` (for example `https://test-dev-mdm.intteger.uk/device-info/<hardware-id>`). The page shows hostname, MDM server URL, agent version, and last sync time from the central server — no local HTTP listener is used on the device.

If the menu still opens `127.0.0.1:49152`, an old tray helper process is still running. Restart the `SingularityMDMAgent` service (or sign out and back in) after deploying a new agent build so the updated `-tray` helper is launched.
