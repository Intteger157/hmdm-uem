import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ThemeIconToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted
    ? theme === 'system' || !theme
      ? resolvedTheme
      : theme
    : 'light'

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('theme.light')}
        aria-pressed={activeTheme === 'light'}
        className={cn(
          'text-muted-foreground',
          activeTheme === 'light' && 'bg-muted text-foreground',
        )}
        onClick={() => setTheme('light')}
      >
        <Sun />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t('theme.dark')}
        aria-pressed={activeTheme === 'dark'}
        className={cn(
          'text-muted-foreground',
          activeTheme === 'dark' && 'bg-muted text-foreground',
        )}
        onClick={() => setTheme('dark')}
      >
        <Moon />
      </Button>
    </div>
  )
}
