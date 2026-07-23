//go:build !windows

package system

func reconcileCPUCounts(cores, threads int) (int, int) {
	if threads > 0 && cores > threads {
		return threads, cores
	}
	return cores, threads
}
