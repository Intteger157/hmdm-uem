# HMDM Windows Agent MSI Builder

Builds a **universal** MSI with only the MDM server URL. Enrollment tokens are applied per device via a PowerShell script from the admin console.

## Prerequisites

- Go 1.25+
- **One of:**
  - WiX v4 CLI: `dotnet tool install --global wix`
  - Docker (builds local `hmdm-wix-builder` image from `Dockerfile.wix`)

## Usage

```powershell
.\build-msi.ps1 -ServerUrl "https://test-dev-mdm.intteger.uk"
```

Output: `dist/HMDMAgent.msi`

## Admin workflow

1. Build MSI **once** (command above).
2. In MDM console: **Add device** → upload MSI → **Register installer** (one-time setup).
3. For each new PC: **Add device** → send user:
   - one-time MSI download link (same file every time)
   - enrollment PowerShell script (unique token per device)

## What the MSI installs

- `HMDMAgent.exe` → `C:\Program Files\HMDM\Agent\`
- Windows service `HMDMAgent` (auto-start)
- Registry `HKLM\SOFTWARE\HMDM\Agent\ServerURL`

Enrollment token is **not** in the MSI — user runs the script from the console after install.
