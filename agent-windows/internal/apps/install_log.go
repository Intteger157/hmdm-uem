//go:build windows

package apps

import (
	"log"
	"strings"
)

const (
	InstallStatusDownloading = "Downloading"
	InstallStatusInstalling  = "Installing"
	InstallStatusSuccess     = "Success"
	InstallStatusFailed      = "Failed"
)

// InstallProgressReporter sends unified app install updates to Action Logs.
type InstallProgressReporter struct {
	logger  StepLogger
	appID   uint
	appName string
	log     strings.Builder
}

func newInstallProgressReporter(logger StepLogger, appID uint, appName string) *InstallProgressReporter {
	return &InstallProgressReporter{
		logger:  logger,
		appID:   appID,
		appName: appName,
	}
}

func (r *InstallProgressReporter) note(detail string) {
	detail = strings.TrimSpace(detail)
	if detail == "" {
		return
	}
	if r.log.Len() > 0 {
		r.log.WriteString("\n")
	}
	r.log.WriteString(detail)
}

func (r *InstallProgressReporter) report(status string) {
	reportInstallProgress(r.logger, r.appID, r.appName, status, r.log.String())
}

func (r *InstallProgressReporter) Report(status, detail string) {
	r.note(detail)
	r.report(status)
}

func reportInstallProgress(logger StepLogger, appID uint, appName, status, output string) {
	if logger == nil {
		return
	}
	if err := logger(appID, appName, status, output); err != nil {
		log.Printf("app install log failed id=%d status=%s: %v", appID, status, err)
	}
}
