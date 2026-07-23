# HMDM Windows Agent MSI Builder

Fleet-style flow: MDM panel gives an **enrollment secret** and a **build command**.

## Prerequisites (Windows only)

- Go 1.25+
- **WiX v4** (MSI can only be built on Windows):

```powershell
dotnet tool install --global wix
```

WiX **does not** produce valid MSI inside a Linux Docker container.

## Usage

```powershell
.\agent-windows\installer\build-msi.ps1 `
  -ServerUrl "https://test-dev-mdm.intteger.uk" `
  -Token "win-enroll-..."
```

Output: `agent-windows\installer\dist\HMDMAgent.msi`

## Workflow

1. **Add device** in MDM console → copy secret + command
2. Run command in PowerShell from repo root
3. Upload MSI in dialog → one-time link for user
