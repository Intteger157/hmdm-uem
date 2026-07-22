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

  const isDark = activeTheme === 'dark'

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? t('theme.light') : t('theme.dark')}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      onClick={handleToggle}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  )
}
