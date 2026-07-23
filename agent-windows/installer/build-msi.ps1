param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$OutDir = "dist",

    [string]$WixImage = "ghcr.io/wixtoolset/wix:v4.0.5"
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

Write-Host "Building MSI with WiX (Docker) ..."
docker run --rm `
    -v "${agentRoot}:/src" `
    -w /src/installer `
    $WixImage `
    wix build Package.wxs `
        -d "ServerUrl=$ServerUrl" `
        -d "EnrollmentToken=$Token" `
        -d "AgentBinary=staging/HMDMAgent.exe" `
        -o "$OutDir/HMDMAgent.msi"

Write-Host "Done: $outputMsi"
