import type { AppDeploymentStatus } from '@/features/windows/applications/types/software-app'

export function appDeploymentStatusBadgeVariant(
  status: AppDeploymentStatus,
): 'default' | 'destructive' | 'secondary' | 'outline' {
  switch (status) {
    case 'Success':
      return 'default'
    case 'Failed':
    case 'Timeout':
      return 'destructive'
    case 'Downloading':
    case 'Installing':
      return 'secondary'
    case 'Canceled':
      return 'outline'
    default:
      return 'outline'
  }
}

export function appDeploymentStatusBadgeClassName(status: AppDeploymentStatus): string {
  switch (status) {
    case 'Pending':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
    case 'Success':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    case 'Downloading':
    case 'Installing':
      return 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300'
    case 'Canceled':
      return 'border-slate-500/40 bg-slate-500/10 text-slate-600 dark:text-slate-300'
    case 'Failed':
    case 'Timeout':
      return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    default:
      return ''
  }
}

export function isAppDeploymentInProgress(status: AppDeploymentStatus): boolean {
  return status === 'Pending' || status === 'Downloading' || status === 'Installing'
}
