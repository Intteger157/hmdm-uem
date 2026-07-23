//go:build windows

package system

import (
	"strings"
	"testing"
)

func TestProtectionOffDoesNotMatchProtectionOn(t *testing.T) {
	line := "protection status:    protection off"
	if strings.Contains(line, "protection on") {
		t.Fatal("protection off line incorrectly contains protection on")
	}
}

func TestProtectionOnLineMatches(t *testing.T) {
	line := "protection status:    protection on"
	if !strings.Contains(line, "protection on") {
		t.Fatal("expected protection on match")
	}
}
