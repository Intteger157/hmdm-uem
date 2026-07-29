import { useTranslation } from 'react-i18next'
import type { AccessLevel, PlatformScope } from '@/features/roles/api/role-matrix-api'
import { cn } from '@/lib/utils'

// Strict flat 2D: square corners, no shadow, colour carried by a hairline border
// and a low-opacity fill.
const badgeClassName =
  'inline-flex items-center border px-2 py-0.5 text-xs font-medium leading-5 rounded-none'

const platformScopeClassName: Record<PlatformScope, string> = {
  global: 'border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-300',
  windows: 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  android: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
}

// Access level rides alongside a coloured platform badge, so it stays neutral and
// signals rank through contrast instead of hue.
const accessLevelClassName: Record<AccessLevel, string> = {
  high: 'border-zinc-400 bg-zinc-500/15 text-zinc-700 dark:border-zinc-500 dark:text-zinc-100',
  mid: 'border-zinc-400/70 bg-zinc-500/10 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300',
  low: 'border-zinc-400/50 bg-transparent text-zinc-500 dark:border-zinc-700 dark:text-zinc-400',
}

export function PlatformScopeBadge({ scope }: { scope: PlatformScope }) {
  const { t } = useTranslation()

  return (
    <span className={cn(badgeClassName, platformScopeClassName[scope])}>
      {t(`roles.scope.${scope}`)}
    </span>
  )
}

export function AccessLevelBadge({ level }: { level: AccessLevel }) {
  const { t } = useTranslation()

  return (
    <span className={cn(badgeClassName, accessLevelClassName[level])}>
      {t(`roles.level.${level}`)}
    </span>
  )
}
