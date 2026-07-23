# HMDM Windows Agent MSI Builder

One **universal MSI** for all PCs. The org enrollment secret is embedded at build time.

## Prerequisites (Windows only)

- Go 1.25+
- WiX v4:

```powershell
dotnet tool install --global wix
```

## One-time setup

1. Open **Devices → Windows → Add device** in MDM console
2. Copy the **org enrollment secret** (`win-enroll-org-...`)
3. Build MSI from repo root:

```powershell
.\agent-windows\installer\build-msi.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-org-..."
```

Output: `agent-windows\installer\dist\HMDMAgent.msi`

## Distribution

Distribute `HMDMAgent.msi` to users however you prefer (USB, GPO, file share, email, etc.). No upload to MDM is required.

Each PC enrolls automatically after install and appears under **Devices → Windows**.
