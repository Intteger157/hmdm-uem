#Requires -RunAsAdministrator
param(
    [string]$MsiPath = (Join-Path $PSScriptRoot "dist\HMDMAgent.msi"),
    [string]$ServerUrl = "https://test-dev-mdm.intteger.uk",
    [string]$ServiceName = "HMDMAgent",
    [string]$AgentExe = "${env:ProgramFiles}\HMDM\Agent\HMDMAgent.exe"
)

$ErrorActionPreference = "Stop"

function Test-ServiceExists([string]$Name) {
    return $null -ne (Get-Service -Name $Name -ErrorAction SilentlyContinue)
}

function Ensure-AgentService {
    param([string]$ExePath)

    if (-not (Test-Path $ExePath)) {
        throw "Agent binary not found: $ExePath"
    }

    if (Test-ServiceExists $ServiceName) {
        Write-Host "Service $ServiceName already exists."
        return
    }

    Write-Host "Creating Windows service $ServiceName ..."
    sc.exe create $ServiceName binPath= "`"$ExePath`"" start= auto obj= LocalSystem DisplayName= "HMDM Windows Agent" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "sc create failed with exit code $LASTEXITCODE"
    }
    sc.exe description $ServiceName "Headwind MDM agent for Windows device management" | Out-Null
}

if (-not (Test-Path $MsiPath)) {
    throw "MSI not found: $MsiPath. Run build-msi.ps1 first."
}

Write-Host "Installing MSI: $MsiPath"
$logPath = Join-Path $env:TEMP "HMDMAgent-install.log"
$process = Start-Process msiexec.exe -ArgumentList @("/i", $MsiPath, "/qn", "/l*v", $logPath) -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "msiexec failed with exit code $($process.ExitCode). Log: $logPath"
}

Ensure-AgentService -ExePath $AgentExe

if (Test-Path "HKLM:\SOFTWARE\HMDM\Agent") {
    Set-ItemProperty -Path "HKLM:\SOFTWARE\HMDM\Agent" -Name "ServerURL" -Value $ServerUrl
}

Write-Host "Starting service $ServiceName ..."
if (Test-ServiceExists $ServiceName) {
    $svc = Get-Service $ServiceName
    if ($svc.Status -ne "Running") {
        Start-Service $ServiceName
    }
    Get-Service $ServiceName | Format-List Name, Status, StartType
} else {
    throw "Service $ServiceName was not created. Check log: $logPath"
}

Write-Host "Done."
