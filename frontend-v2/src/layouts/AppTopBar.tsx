import { LogOut, Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { ThemeIconToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

type AppTopBarProps = {
  userLabel?: string
  onLogout: () => void
}

export function AppTopBar({ userLabel, onLogout }: AppTopBarProps) {
  const { t } = useTranslation()
  const { toggleSidebar } = useSidebar()

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 md:hidden"
          onClick={toggleSidebar}
          aria-label={t('nav.openMenu')}
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex shrink-0 items-center gap-3">
          <Logo size="sm" alt="" />
          <p className="text-lg font-semibold leading-tight text-foreground">{t('app.title')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <ThemeIconToggle />
        {userLabel ? (
          <span className="hidden text-sm text-muted-foreground sm:inline">{userLabel}</span>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={onLogout}
        >
          <LogOut />
          {t('nav.logout')}
        </Button>
      </div>
    </header>
  )
}
