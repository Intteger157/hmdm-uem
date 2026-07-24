# Singularity MDM Agent MSI Builder

One **universal MSI** for all PCs. The org enrollment secret is embedded at build time.

Prefer `..\build-agent.ps1 -Msi` — it builds the shared binary once and produces both the Autopilot EXE and this MSI.

## Prerequisites (Windows only)

- Go 1.25+
- WiX v4:

```powershell
dotnet tool install --global wix
```

## One-time setup

1. Open **Devices → Windows → Add device** in MDM console
2. Copy the **org enrollment secret** (`win-enroll-org-...`)
3. Build from repo root:

```powershell
.\agent-windows\build-agent.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-org-..." `
  -Msi
```

Output: `agent-windows\installer\dist\singularity-agent.msi`

## Distribution

Distribute `singularity-agent.msi` to users however you prefer (USB, GPO, file share, email, etc.). You can also upload it to Java MDM at `files/windows/agents/singularity-agent.msi`.

Each PC enrolls automatically after install and appears under **Devices → Windows**.
