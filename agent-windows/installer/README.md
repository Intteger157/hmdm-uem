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
2. Copy the **org enrollment secret** (stable, same every time)
3. Build MSI from repo root:

```powershell
.\agent-windows\installer\build-msi.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-org-..."
```

4. Upload `agent-windows\installer\dist\HMDMAgent.msi` in the dialog

## End-user install

Share the installer link from the console. Each PC enrolls automatically and appears under **Devices → Windows**.
