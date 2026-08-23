//go:build windows

package tray

import "testing"

func TestTraySingletonMutexName(t *testing.T) {
	if traySingletonMutexName == "" {
		t.Fatal("expected singleton mutex name")
	}
}
