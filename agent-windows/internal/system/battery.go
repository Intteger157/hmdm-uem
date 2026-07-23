package system

import "github.com/yusufpapurcu/wmi"

type win32Battery struct {
	EstimatedChargeRemaining uint16
	BatteryStatus            uint16
}

func collectBatteryInfo() (*int, string) {
	var batteries []win32Battery
	if err := wmi.Query("SELECT EstimatedChargeRemaining, BatteryStatus FROM Win32_Battery", &batteries); err != nil || len(batteries) == 0 {
		return nil, ""
	}

	totalCharge := 0
	count := 0
	status := mapBatteryStatus(batteries[0].BatteryStatus)

	for _, battery := range batteries {
		if battery.EstimatedChargeRemaining <= 100 {
			totalCharge += int(battery.EstimatedChargeRemaining)
			count++
		}
		if isChargingBatteryStatus(battery.BatteryStatus) {
			status = "Charging"
		}
	}

	if count == 0 {
		return nil, ""
	}

	level := totalCharge / count
	return &level, status
}

func isChargingBatteryStatus(code uint16) bool {
	switch code {
	case 6, 7, 8, 9:
		return true
	default:
		return false
	}
}

func mapBatteryStatus(code uint16) string {
	switch code {
	case 1:
		return "Discharging"
	case 2:
		return "On AC Power"
	case 3:
		return "Fully Charged"
	case 4:
		return "Low"
	case 5:
		return "Critical"
	case 6, 7, 8, 9:
		return "Charging"
	case 11:
		return "Partially Charged"
	default:
		return "Unknown"
	}
}
