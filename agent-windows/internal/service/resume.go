//go:build windows

package service

// Windows power/session notification constants used by the HMDM agent service.
const (
	PBTAPMResumeAutomatic = 18
	PBTAPMResumeSuspend   = 7
	WTSSessionLogon       = 0x5
	WTSSessionUnlock      = 0x8
)

// ShouldSyncOnPowerEvent reports whether the agent should sync after a service power event.
func ShouldSyncOnPowerEvent(eventType uint32) bool {
	switch eventType {
	case PBTAPMResumeAutomatic, PBTAPMResumeSuspend:
		return true
	default:
		return false
	}
}

// ShouldSyncOnSessionEvent reports whether the agent should sync after a session change event.
func ShouldSyncOnSessionEvent(eventType uint32) bool {
	switch eventType {
	case WTSSessionLogon, WTSSessionUnlock:
		return true
	default:
		return false
	}
}
