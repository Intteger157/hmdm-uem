import { useTranslation } from 'react-i18next'

export function DeviceActionsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('deviceDetail.actions.pageSubtitle')}</p>
    </div>
  )
}
