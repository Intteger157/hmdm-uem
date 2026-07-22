import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'

type ThemeOption = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const value: ThemeOption =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-muted-foreground" htmlFor="theme-select">
        {t('nav.theme')}
      </label>
      <select
        id="theme-select"
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        value={mounted ? value : 'system'}
        onChange={(event) => setTheme(event.target.value as ThemeOption)}
      >
        <option value="light">{t('theme.light')}</option>
        <option value="dark">{t('theme.dark')}</option>
        <option value="system">{t('theme.system')}</option>
      </select>
      {mounted && value === 'system' && (
        <p className="text-xs text-muted-foreground">
          {resolvedTheme === 'dark' ? t('theme.usingDark') : t('theme.usingLight')}
        </p>
      )}
    </div>
  )
}
