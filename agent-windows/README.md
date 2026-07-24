# Singularity MDM Windows Agent

One Go codebase produces two distribution formats with **identical functionality**:

| Artifact | Path | Purpose |
|----------|------|---------|
| **Autopilot EXE** | `deploy/volumes/files/singularity-autopilot/singularity-agent.exe` | Bootstrap / zero-touch enrollment (`GET /rest/windows/enroll`) |
| **Distribution MSI** | `agent-windows/installer/dist/singularity-agent.msi` | Manual install (USB, GPO, file share, Java `/files/` upload) |

When you add agent features, rebuild **both** artifacts from the same source.

## Build (Windows)

Prerequisites: Go 1.25+, WiX v4 (`dotnet tool install --global wix`).

1. Open **Devices → Windows → Add device** in the MDM console.
2. Copy the org enrollment secret (`win-enroll-org-...`).
3. From repo root:

```powershell
.\agent-windows\build-agent.ps1 `
  -ServerUrl "https://your-mdm.example.com" `
  -Token "win-enroll-org-..." `
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
