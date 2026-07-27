//go:build windows

package files

import (
	"path/filepath"
	"testing"
)

func TestAcquireFileDownloadLock(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "file.zip")

	release, acquired := acquireFileDownloadLock(path)
	if !acquired {
		t.Fatal("expected to acquire lock")
	}

	_, acquiredAgain := acquireFileDownloadLock(path)
	if acquiredAgain {
		t.Fatal("expected second acquire to fail while lock is held")
	}

	release()

	release2, reacquired := acquireFileDownloadLock(path)
	if !reacquired {
		t.Fatal("expected to acquire lock after release")
	}
	release2()
}
