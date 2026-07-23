param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,

    [string]$OutDir = "dist",

    [string]$WixImage = "hmdm-wix-builder:local"
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

function Invoke-WixBuild {
    param(
        [string]$WixCommand
    )

    Push-Location $installerDir
    try {
        & $WixCommand build Package.wxs `
            -d "ServerUrl=$ServerUrl" `
            -d "AgentBinary=staging/HMDMAgent.exe" `
            -o "$OutDir/HMDMAgent.msi"

        if ($LASTEXITCODE -ne 0) {
            throw "wix build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

function Test-DockerReady {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        return $false
    }

    docker info *> $null
    return $LASTEXITCODE -eq 0
}

$built = $false

if (Get-Command wix -ErrorAction SilentlyContinue) {
    Write-Host "Building universal MSI with local WiX ..."
    try {
        Invoke-WixBuild "wix"
        $built = $true
    }
    catch {
        Write-Warning $_.Exception.Message
    }
}

if (-not $built -and (Test-DockerReady)) {
    Write-Host "Building universal MSI with WiX (Docker) ..."
    $dockerfile = Join-Path $installerDir "Dockerfile.wix"
    docker build -f $dockerfile -t $WixImage $installerDir
    if ($LASTEXITCODE -ne 0) {
        throw "docker build for WiX failed with exit code $LASTEXITCODE"
    }

    try {
        docker run --rm `
            -v "${agentRoot}:/src" `
            -w /src/installer `
            $WixImage `
            build Package.wxs `
                -d "ServerUrl=$ServerUrl" `
                -d "AgentBinary=staging/HMDMAgent.exe" `
                -o "$OutDir/HMDMAgent.msi"

        if ($LASTEXITCODE -ne 0) {
            throw "docker wix build failed with exit code $LASTEXITCODE"
        }
        $built = $true
    }
    catch {
        Write-Warning $_.Exception.Message
    }
}

if (-not $built) {
    throw @"
MSI build failed.

Install WiX v4 locally:
  dotnet tool install --global wix

Or start Docker Desktop and rerun this script.
"@
}

if (-not (Test-Path $outputMsi)) {
    throw "MSI was not created: $outputMsi"
}

Write-Host "Done: $outputMsi"
Write-Host "Upload this MSI once in MDM console (Add device -> Register installer)."
