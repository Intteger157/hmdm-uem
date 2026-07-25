# Singularity MDM Windows Agent

One Go codebase produces two distribution formats with **identical functionality**:

| Artifact | Path | Purpose |
|----------|------|---------|
| **Autopilot EXE** | `deploy/volumes/files/singularity-autopilot/singularity-agent.exe` | Bootstrap / zero-touch enrollment (`GET /rest/windows/enroll`) |
| **Distribution MSI** | `agent-windows/installer/dist/singularity-agent.msi` | Manual install (USB, GPO, file share, Java `/files/` upload) |

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
  -ServerUrl "httpы://test-dev-mdm.intteger.uk" `
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

The Windows service remains `HMDMAgent` for compatibility with existing deployments. The on-disk binary is always `singularity-agent.exe`.

## Local device information page

The service exposes a loopback-only page at `http://127.0.0.1:49152/` with hostname, MDM server URL, agent version, and last sync time. The tray helper menu item **Device Information** opens this page in the default browser.
