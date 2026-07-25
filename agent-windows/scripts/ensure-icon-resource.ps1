param(
    [Parameter(Mandatory = $true)]
    [string]$AgentRoot
)

$ErrorActionPreference = "Stop"

$iconPath = Join-Path $AgentRoot "icon.ico"
$sysoPath = Join-Path $AgentRoot "rsrc.syso"

if (-not (Test-Path $iconPath)) {
    throw "Missing agent icon: $iconPath"
}

$rsrcCmd = Get-Command rsrc -ErrorAction SilentlyContinue
if (-not $rsrcCmd) {
    Write-Host "Installing rsrc (PE icon resource generator)..."
    go install github.com/akavel/rsrc@latest
    $rsrcCmd = Get-Command rsrc -ErrorAction SilentlyContinue
}

if (-not $rsrcCmd) {
    $fallbackRsrc = Join-Path (go env GOPATH) "bin\rsrc.exe"
    if (-not (Test-Path $fallbackRsrc)) {
        throw "rsrc not found. Install with: go install github.com/akavel/rsrc@latest"
    }
    $rsrcCmd = $fallbackRsrc
}

Write-Host "Generating rsrc.syso from icon.ico ..."
& $rsrcCmd -ico $iconPath -o $sysoPath

if (-not (Test-Path $sysoPath)) {
    throw "Failed to generate $sysoPath"
}
