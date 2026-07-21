import { useTranslation } from 'react-i18next'

export function DashboardPage() {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-semibold">{t('dashboard.title')}</h1>
      <p className="text-slate-600">{t('dashboard.placeholder')}</p>
    </div>
  )
}
