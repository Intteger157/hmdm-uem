package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	appstorage "github.com/hmdm/server-windows/internal/storage"
)

const bootstrapServiceName = "HMDMAgent"

// GetEnrollBootstrapScript returns a PowerShell bootstrap script for zero-touch agent install.
func (h *WindowsHandler) GetEnrollBootstrapScript(c *gin.Context) {
	orgToken, err := getOrCreateOrgEnrollmentToken()
	if err != nil {
		log.Printf("[enroll-bootstrap] org token failed: %v", err)
		c.String(http.StatusInternalServerError, "Failed to prepare enrollment bootstrap script.")
		return
	}

	serverURL := strings.TrimRight(buildPublicURL(c, ""), "/")
	agentURL := buildPublicURL(c, appstorage.AgentPublicPath())
	script := buildBootstrapScript(serverURL, orgToken, agentURL)

	c.Header("Content-Type", "text/plain; charset=utf-8")
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

func buildBootstrapScript(serverURL, enrollmentToken, agentDownloadURL string) string {
	installDir := `C:\Program Files\SingularityMDM`
	stateDir := `C:\ProgramData\HMDM\Agent`
	stateFile := stateDir + `\state.json`
	agentExe := installDir + `\singularity-agent.exe`

	return fmt.Sprintf(`# Singularity MDM — Windows agent bootstrap
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$InstallDir = '%s'
$AgentExe = '%s'
$ServiceName = '%s'
$ServerUrl = '%s'
$EnrollmentToken = '%s'
$AgentDownloadUrl = '%s'
$StateDir = '%s'
$StateFile = '%s'

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
`, installDir, agentExe, bootstrapServiceName, serverURL, enrollmentToken, agentDownloadURL, stateDir, stateFile)
}
