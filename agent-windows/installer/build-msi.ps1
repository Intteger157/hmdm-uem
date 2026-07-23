param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$OutDir = "dist"
)

$ErrorActionPreference = "Stop"

$installerDir = $PSScriptRoot
$agentRoot = Split-Path -Parent $installerDir
$stagingDir = Join-Path $installerDir "staging"
$outputDir = Join-Path $installerDir $OutDir
$stagingExe = Join-Path $stagingDir "HMDMAgent.exe"
$outputMsi = Join-Path $outputDir "HMDMAgent.msi"

New-Item -ItemType Directory -Force -Path $stagingDir, $outputDir | Out-Null

Write-Host "Building HMDMAgent.exe ..."
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

if (-not (Get-Command wix -ErrorAction SilentlyContinue)) {
    throw @"
WiX v4 is required on Windows to build MSI packages.

Install once:
  dotnet tool install --global wix

Then restart PowerShell and rerun this script.

Note: WiX cannot build MSI inside a Linux Docker container.
"@
}

Write-Host "Building MSI with WiX ..."
Push-Location $installerDir
try {
    wix build Package.wxs `
        -d "ServerUrl=$ServerUrl" `
        -d "EnrollmentToken=$Token" `
        -d "AgentBinary=staging/HMDMAgent.exe" `
        -o "$OutDir/HMDMAgent.msi"

    if ($LASTEXITCODE -ne 0) {
        throw "wix build failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path $outputMsi)) {
    throw "MSI was not created: $outputMsi"
}

Write-Host "Done: $outputMsi"
