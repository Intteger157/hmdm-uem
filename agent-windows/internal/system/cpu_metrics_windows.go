//go:build windows

package system

import "github.com/yusufpapurcu/wmi"

type win32Processor struct {
	NumberOfCores             uint32
	NumberOfLogicalProcessors uint32
}

func collectCPUCountsWMI() (physical int, logical int) {
	var processors []win32Processor
	if err := wmi.Query(
		"SELECT NumberOfCores, NumberOfLogicalProcessors FROM Win32_Processor",
		&processors,
	); err != nil {
		return 0, 0
	}

	for _, processor := range processors {
		if processor.NumberOfCores > 0 {
			physical += int(processor.NumberOfCores)
		}
		if processor.NumberOfLogicalProcessors > 0 {
			logical += int(processor.NumberOfLogicalProcessors)
		}
	}
	return physical, logical
}

func reconcileCPUCounts(cores, threads int) (int, int) {
	wmiCores, wmiThreads := collectCPUCountsWMI()

	if threads == 0 && wmiThreads > 0 {
		threads = wmiThreads
	}
	if cores == 0 && wmiCores > 0 {
		cores = wmiCores
	}

	// gopsutil can report logical count as "physical" on some Windows builds.
	if threads > 0 && cores >= threads && wmiCores > 0 && wmiThreads > 0 && wmiCores < wmiThreads {
		cores = wmiCores
		threads = wmiThreads
	}

	if threads > 0 && cores > threads {
		cores, threads = threads, cores
	}

	return cores, threads
}
