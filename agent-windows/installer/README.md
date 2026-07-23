# HMDM Windows Agent MSI Builder

Builds a per-enrollment MSI with `ServerURL` and `EnrollmentToken` baked into the registry.

## Prerequisites

- Go 1.25+
- **One of:**
  - WiX v4 CLI: `dotnet tool install --global wix`
  - Docker (builds local `hmdm-wix-builder` image from `Dockerfile.wix`)

The public `ghcr.io/wixtoolset/wix` image may be unavailable; the script uses a local Docker build instead.

## Usage

From this directory on Windows:

```powershell
.\build-msi.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-abc123..."
```

On Linux/macOS:

```bash
chmod +x build-msi.sh
./build-msi.sh "https://test-dev-mdm.intteger.uk" "win-enroll-abc123..."
```

Output: `dist/HMDMAgent.msi`

## What the MSI installs

- `HMDMAgent.exe` → `C:\Program Files\HMDM\Agent\`
- Windows service `HMDMAgent` (auto-start)
- Registry `HKLM\SOFTWARE\HMDM\Agent`:
  - `ServerURL`
  - `EnrollmentToken`

After install, upload the MSI in the MDM console (**Add device** dialog) to get a one-time download link for the end user.
