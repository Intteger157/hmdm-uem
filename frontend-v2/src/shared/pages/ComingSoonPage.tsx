import { useTranslation } from 'react-i18next'
import { PageContainer, PageHeader } from '@/shared/layout/page-layout'

interface ComingSoonPageProps {
  titleKey: string
}

export function ComingSoonPage({ titleKey }: ComingSoonPageProps) {
  const { t } = useTranslation()

  return (
    <PageContainer>
      <PageHeader title={t(titleKey)} description={t('common.comingSoon')} />
    </PageContainer>
  )
}
