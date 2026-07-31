param(
    [string]$AgentRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$LogoSvg = (Join-Path (Split-Path $AgentRoot -Parent) "frontend-v2\public\logo.svg")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $LogoSvg)) {
    throw "Brand logo not found: $LogoSvg"
}

$iconPath = Join-Path $AgentRoot "icon.ico"
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$packScript = @"
import { writeFileSync } from 'node:fs';
import pngToIco from 'png-to-ico';
const sizes = [$($sizes -join ', ')];
const files = sizes.map((s) => 'icon-' + s + '.png');
const ico = await pngToIco(files);
writeFileSync('icon.ico', ico);
console.log('Packed icon.ico (' + ico.length + ' bytes)');
"@

Push-Location $AgentRoot
try {
    Write-Host "Rendering agent icon sizes from $LogoSvg ..."
    foreach ($size in $sizes) {
        $pngPath = Join-Path $AgentRoot "icon-$size.png"
        npx --yes @resvg/resvg-js-cli --fit-width $size $LogoSvg $pngPath | Out-Null
        if (-not (Test-Path $pngPath)) {
            throw "Failed to render $pngPath"
        }
    }

    Write-Host "Packing icon.ico ..."
    npx --yes -p png-to-ico node --input-type=module -e $packScript

    if (-not (Test-Path $iconPath)) {
        throw "Failed to write $iconPath"
    }

    foreach ($size in $sizes) {
        Remove-Item (Join-Path $AgentRoot "icon-$size.png") -Force -ErrorAction SilentlyContinue
    }

    & (Join-Path $PSScriptRoot "ensure-icon-resource.ps1") -AgentRoot $AgentRoot
    Write-Host "Agent brand icon updated: $iconPath"
}
finally {
    Pop-Location
}
