import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LoginHeroIllustration } from '@/features/auth/components/LoginHeroIllustration'

export function LoginHeroSection() {
  const { t } = useTranslation()

  return (
    <div className="login-fade-in flex max-w-xl flex-col gap-10">
      <div className="relative flex items-center justify-center py-4">
        <LoginHeroIllustration />
      </div>

      <div className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium tracking-wide text-slate-300 uppercase">
          <Shield className="size-3.5 text-blue-400/90" strokeWidth={2} />
          {t('login.heroEyebrow')}
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-white xl:text-[2.75rem] xl:leading-tight">
            {t('login.heroTitle')}
          </h1>
          <p className="max-w-md text-base leading-relaxed text-slate-400 xl:text-[1.05rem]">
            {t('login.heroDescription')}
          </p>
        </div>

        <ul className="flex flex-wrap gap-2.5 pt-1">
          {[t('login.heroBadge1'), t('login.heroBadge2'), t('login.heroBadge3')].map((label) => (
            <li
              key={label}
              className="rounded-lg border border-white/[0.06] bg-[#101010]/60 px-3 py-1.5 text-xs font-medium text-slate-400"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
