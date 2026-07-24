package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/models"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

const bootstrapServiceName = "HMDMAgent"

// GetEnrollBootstrapScript returns a PowerShell bootstrap script for zero-touch agent install.
func (h *WindowsHandler) GetEnrollBootstrapScript(c *gin.Context) {
	security, err := loadEnrollmentSecurityForBootstrap()
	if err != nil {
		log.Printf("[enroll-bootstrap] security settings failed: %v", err)
		c.String(http.StatusServiceUnavailable, "Enrollment security is not configured.")
		return
	}

	embeddedSecret := ""
	if security.EnrollmentMode == models.EnrollmentModeToken {
		urlToken := strings.TrimSpace(c.Query("token"))
		if urlToken == "" || enrollmentSecretsMismatch(urlToken, security.EnrollmentSecret) {
			c.String(http.StatusForbidden, "Invalid or missing enrollment token.")
			return
		}
		embeddedSecret = urlToken
	}

	provisioning, err := loadActiveEnrollmentProvisioning()
	if err != nil {
		log.Printf("[enroll-bootstrap] provisioning settings failed: %v", err)
		c.String(http.StatusInternalServerError, "Failed to prepare enrollment bootstrap script.")
		return
	}

	serverURL := strings.TrimRight(buildPublicURL(c, ""), "/")
	agentURL := buildPublicURL(c, appstorage.AgentPublicPath())
	script := buildBootstrapScript(serverURL, agentURL, security.EnrollmentMode, embeddedSecret, provisioning)

	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Cache-Control", "no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.String(http.StatusOK, script)
}

// DownloadAgentBinary serves the Windows agent executable for bootstrap installs.
func (h *WindowsHandler) DownloadAgentBinary(c *gin.Context) {
	binaryPath := appstorage.AgentBinaryPath()
	info, err := os.Stat(binaryPath)
	if err != nil || info.IsDir() || info.Size() == 0 {
		c.String(http.StatusNotFound, "Agent binary is not published on the server.")
		return
	}

	c.Header("Content-Type", "application/octet-stream")
	c.FileAttachment(binaryPath, appstorage.AgentBinaryName)
}

func buildBootstrapScript(
	serverURL, agentDownloadURL, enrollmentMode, embeddedSecret string,
	provisioning *models.WindowsEnrollmentProvisioningSettings,
) string {
	installDir := `C:\Program Files\SingularityMDM`
	stateDir := `C:\ProgramData\HMDM\Agent`
	stateFile := stateDir + `\state.json`
	agentExe := installDir + `\singularity-agent.exe`

	securityBlock := buildEnrollmentSecurityBlock(enrollmentMode, embeddedSecret)
	provisioningBlock := buildProvisioningBlock(provisioning)

	return fmt.Sprintf(`# Singularity MDM — Windows agent bootstrap
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$InstallDir = '%s'
$AgentExe = '%s'
$ServiceName = '%s'
$ServerUrl = '%s'
$AgentDownloadUrl = '%s'
$StateDir = '%s'
$StateFile = '%s'
$RegisterUrl = ($ServerUrl.TrimEnd('/') + '/api/windows/register')

%s
Write-Host 'Singularity MDM: validating enrollment credentials...'
$RegisterResponse = Invoke-RestMethod -Uri $RegisterUrl -Method Post -Body (@{ enrollment_secret = $EnrollmentSecret } | ConvertTo-Json) -ContentType 'application/json; charset=utf-8'
$EnrollmentToken = $RegisterResponse.enrollment_token
if ([string]::IsNullOrWhiteSpace($EnrollmentToken)) {
    throw 'Enrollment registration failed: missing enrollment token.'
}

Write-Host 'Singularity MDM: preparing install directory...'
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host 'Singularity MDM: downloading agent...'
Invoke-WebRequest -Uri $AgentDownloadUrl -OutFile $AgentExe -UseBasicParsing

Write-Host 'Singularity MDM: writing agent state...'
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
@{
    server_url = $ServerUrl
    enrollment_token = $EnrollmentToken
} | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

Write-Host 'Singularity MDM: configuring registry...'
New-Item -Path 'HKLM:\SOFTWARE\HMDM\Agent' -Force | Out-Null
Set-ItemProperty -Path 'HKLM:\SOFTWARE\HMDM\Agent' -Name 'ServerURL' -Value $ServerUrl
Set-ItemProperty -Path 'HKLM:\SOFTWARE\HMDM\Agent' -Name 'EnrollmentToken' -Value $EnrollmentToken

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -ne $existing) {
    Write-Host 'Singularity MDM: replacing existing service...'
    if ($existing.Status -ne 'Stopped') {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

Write-Host 'Singularity MDM: registering Windows service...'
New-Service -Name $ServiceName -BinaryPathName ('"' + $AgentExe + '"') -DisplayName 'Singularity MDM Agent' -StartupType Automatic | Out-Null

Write-Host 'Singularity MDM: starting agent service...'
Start-Service -Name $ServiceName

Write-Host 'Singularity MDM Agent installed and started successfully.'
%s`, installDir, agentExe, bootstrapServiceName, serverURL, agentDownloadURL, stateDir, stateFile, securityBlock, provisioningBlock)
}

func buildEnrollmentSecurityBlock(enrollmentMode, embeddedSecret string) string {
	if enrollmentMode == models.EnrollmentModePassword {
		return `$EnrollmentSecret = Read-Host "Enter MDM Enrollment Password"`
	}

	return fmt.Sprintf(`$EnrollmentSecret = '%s'`, escapePowerShellSingleQuoted(embeddedSecret))
}

func buildProvisioningBlock(provisioning *models.WindowsEnrollmentProvisioningSettings) string {
	if provisioning == nil {
		return ""
	}

	adminUser := escapePowerShellDoubleQuoted(provisioning.AdminUsername)
	adminPass := escapePowerShellDoubleQuoted(provisioning.AdminPassword)
	wmicUser := escapeWMIStringLiteral(provisioning.AdminUsername)

	return fmt.Sprintf(`
Write-Host 'Singularity MDM: creating local administrator account...'
net user "%s" "%s" /add
net localgroup Administrators "%s" /add
wmic USERACCOUNT WHERE Name='%s' SET PasswordExpires=FALSE

Write-Host 'Singularity MDM: skipping Windows OOBE setup screens...'
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\OOBE" /v SkipMachineOOBE /t REG_DWORD /d 1 /f
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\OOBE" /v SkipUserOOBE /t REG_DWORD /d 1 /f

Write-Host 'Singularity MDM: rebooting in 5 seconds to complete provisioning...'
shutdown /r /t 5
`, adminUser, adminPass, adminUser, wmicUser)
}

func escapePowerShellDoubleQuoted(value string) string {
	value = strings.ReplaceAll(value, "`", "``")
	value = strings.ReplaceAll(value, "$", "`$")
	value = strings.ReplaceAll(value, "\"", "`\"")
	return value
}

func escapePowerShellSingleQuoted(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func escapeWMIStringLiteral(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}
