import { LogOut } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ThemeIconToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

type AppTopBarProps = {
  userLabel?: string
  onLogout: () => void
}

export function AppTopBar({ userLabel, onLogout }: AppTopBarProps) {
  const { t } = useTranslation()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="min-w-0">
        <p className="truncate text-lg font-semibold">{t('app.title')}</p>
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
