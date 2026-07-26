#Requires -RunAsAdministrator
param(
    [string]$MsiPath = (Join-Path $PSScriptRoot "dist\singularity-agent.msi"),
    [string]$ServerUrl = "https://test-dev-mdm.intteger.uk",
    [string]$ServiceName = "SingularityMDMAgent",
    [string]$AgentExe = "${env:ProgramFiles}\Singularity MDM Agent\singularity-agent.exe"
)

$ErrorActionPreference = "Stop"

function Test-ServiceExists([string]$Name) {
    return $null -ne (Get-Service -Name $Name -ErrorAction SilentlyContinue)
}

function Remove-LegacyAgentService {
    param([string]$LegacyServiceName)

    if (-not (Test-ServiceExists $LegacyServiceName)) {
        return
    }

    Write-Host "Removing legacy service $LegacyServiceName ..."
    Stop-Service -Name $LegacyServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $LegacyServiceName | Out-Null
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
    sc.exe create $ServiceName binPath= "`"$ExePath`"" start= auto obj= LocalSystem DisplayName= "Singularity MDM Agent" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "sc create failed with exit code $LASTEXITCODE"
    }
    sc.exe description $ServiceName "Singularity MDM agent for Windows device management" | Out-Null
}

if (-not (Test-Path $MsiPath)) {
    throw "MSI not found: $MsiPath. Run build-agent.ps1 -Msi first."
}

Write-Host "Installing MSI: $MsiPath"
$logPath = Join-Path $env:TEMP "singularity-agent-install.log"
$process = Start-Process msiexec.exe -ArgumentList @("/i", $MsiPath, "/qn", "/l*v", $logPath) -Wait -PassThru
if ($process.ExitCode -ne 0) {
    throw "msiexec failed with exit code $($process.ExitCode). Log: $logPath"
}

Remove-LegacyAgentService -LegacyServiceName "HMDMAgent"
Ensure-AgentService -ExePath $AgentExe

Write-Host "Configuring service autostart, recovery actions, and tray Run registry entry ..."
& $AgentExe -install
if ($LASTEXITCODE -ne 0) {
    throw "singularity-agent.exe -install failed with exit code $LASTEXITCODE"
}

if (Test-Path "HKLM:\SOFTWARE\Singularity MDM\Agent") {
    Set-ItemProperty -Path "HKLM:\SOFTWARE\Singularity MDM\Agent" -Name "ServerURL" -Value $ServerUrl
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
