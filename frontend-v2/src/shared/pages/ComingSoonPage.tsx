import { useTranslation } from 'react-i18next'

interface ComingSoonPageProps {
  titleKey: string
}

export function ComingSoonPage({ titleKey }: ComingSoonPageProps) {
  const { t } = useTranslation()

  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <h1 className="text-xl font-semibold">{t(titleKey)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('common.comingSoon')}</p>
    </div>
  )
}
