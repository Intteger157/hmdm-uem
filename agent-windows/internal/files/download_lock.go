//go:build windows

package files

import "sync"

const downloadAlreadyInProgressMessage = "download already in progress"

var inFlightFileDownloads sync.Map

func acquireFileDownloadLock(cachePath string) (release func(), acquired bool) {
	if _, loaded := inFlightFileDownloads.LoadOrStore(cachePath, true); loaded {
		return nil, false
	}
	return func() {
		inFlightFileDownloads.Delete(cachePath)
	}, true
}
