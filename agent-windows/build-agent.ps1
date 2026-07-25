param(
    [string]$ServerUrl,
    [string]$Token,
    [switch]$Msi,
    [switch]$SkipAutopilotPublish,
    [string]$AutopilotDir
)

$ErrorActionPreference = "Stop"

$agentRoot = $PSScriptRoot
$installerDir = Join-Path $agentRoot "installer"
$stagingDir = Join-Path $installerDir "staging"
$stagingExe = Join-Path $stagingDir "singularity-agent.exe"

if (-not $AutopilotDir) {
    $AutopilotDir = Join-Path $agentRoot "..\deploy\volumes\files\singularity-autopilot"
}

New-Item -ItemType Directory -Force -Path $stagingDir, $AutopilotDir | Out-Null

& (Join-Path $agentRoot "scripts\ensure-icon-resource.ps1") -AgentRoot $agentRoot

Write-Host "Building singularity-agent.exe (shared binary for Autopilot EXE and MSI) ..."
Push-Location $agentRoot
try {
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    $env:CGO_ENABLED = "0"
    go build -ldflags="-s -w" -o $stagingExe .
}
finally {
    Pop-Location
}

if (-not $SkipAutopilotPublish) {
    $autopilotExe = Join-Path $AutopilotDir "singularity-agent.exe"
    Copy-Item -Force $stagingExe $autopilotExe
    Write-Host "Published Autopilot binary: $autopilotExe"
}

$buildMsi = $Msi -or ($ServerUrl -and $Token)
if ($buildMsi) {
    if (-not $ServerUrl -or -not $Token) {
        throw "MSI build requires both -ServerUrl and -Token."
    }

    & (Join-Path $installerDir "build-msi.ps1") -ServerUrl $ServerUrl -Token $Token -SkipBuild
}

Write-Host ""
Write-Host "Artifacts:"
Write-Host "  Autopilot EXE  -> deploy/volumes/files/singularity-autopilot/singularity-agent.exe"
if ($buildMsi) {
    Write-Host "  Distribution MSI -> agent-windows/installer/dist/singularity-agent.msi"
}
