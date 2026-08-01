import { Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { ThemeIconToggle } from '@/components/theme-toggle'

export function AuthLayout() {
  const { t } = useTranslation()

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 bg-gradient-to-br from-slate-900 to-[#1c40e3]/30 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-[#1c40e3]/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col items-center gap-6 px-8 text-center">
          <Logo
            size="xl"
            className="drop-shadow-[0_12px_24px_rgba(28,64,227,0.35)]"
          />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {t('login.brandTitle')}
            </h1>
            <p className="text-base text-slate-400">{t('login.brandSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="relative flex min-h-svh flex-col items-center justify-center bg-[#0a0a0a] px-4 py-8 sm:px-8">
        <div className="absolute right-4 top-4">
          <ThemeIconToggle />
        </div>

        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
