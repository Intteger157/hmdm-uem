# HMDM Windows Agent MSI Builder

Fleet-style flow: the MDM panel gives an **enrollment secret** and a **build command**. Run the command locally (Docker + WiX) to produce an MSI with the secret embedded.

## Prerequisites

- Go 1.25+
- Docker Desktop (preferred — runs WiX in container)
- Or local WiX v4: `dotnet tool install --global wix`

## Usage (from MDM panel command)

```powershell
.\agent-windows\installer\build-msi.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-..."
```

Docker is tried first. The script builds `hmdm-wix-builder:local` from `Dockerfile.wix` if needed.

Output: `agent-windows\installer\dist\HMDMAgent.msi`

## Admin workflow

1. **Add device** in MDM console → copy secret + build command
2. Run command in PowerShell from repo root (Docker Desktop running)
3. Upload built MSI in the dialog → get one-time link for end user
4. User installs MSI → device enrolls automatically

## What the MSI installs

- `HMDMAgent.exe` + Windows service `HMDMAgent`
- Registry `HKLM\SOFTWARE\HMDM\Agent`: `ServerURL` + `EnrollmentToken`
