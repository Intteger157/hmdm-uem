import { useTranslation } from 'react-i18next'
import {
  formatPublicLastSync,
  formatPublicManufacturerModel,
  usePublicDeviceInfoQuery,
} from '@/features/devices/hooks/use-public-device-info-query'

interface PublicDeviceInfoPageProps {
  deviceId: string
}

const laptopImageSrc = '/device-info-laptop.png'

export function PublicDeviceInfoPage({ deviceId }: PublicDeviceInfoPageProps) {
  const { t } = useTranslation()
  const { data, error, isLoading } = usePublicDeviceInfoQuery(deviceId)

  const errorMessage =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status === 404
        ? t('publicDeviceInfo.notFound')
        : t('publicDeviceInfo.loadFailed')
      : t('publicDeviceInfo.loadFailed')

  return (
    <div className="min-h-screen bg-[#0b0f17] px-4 py-8 text-[#f9fafb]">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-2xl border border-[#1f2937] bg-[#111827] shadow-[0_10px_30px_rgba(15,23,42,0.35)]">
          <div className="px-6 pt-6">
            <img
              src={laptopImageSrc}
              alt=""
              className="mx-auto mb-6 max-h-52 w-full max-w-sm object-contain"
            />
          </div>

          <div className="border-b border-[#1f2937] px-6 pb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-[#60a5fa]">
              {t('publicDeviceInfo.badge')}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('publicDeviceInfo.title')}</h1>
            <p className="mt-2 text-sm text-[#9ca3af]">{t('publicDeviceInfo.subtitle')}</p>
          </div>

          {isLoading ? (
            <div className="px-6 py-10 text-sm text-[#9ca3af]">{t('publicDeviceInfo.loading')}</div>
          ) : error || !data ? (
            <div className="px-6 py-10 text-sm text-[#fca5a5]">{errorMessage}</div>
          ) : (
            <dl>
              <InfoRow label={t('publicDeviceInfo.computer')} value={data.hostname || '—'} />
              <InfoRow
                label={t('publicDeviceInfo.manufacturerModel')}
                value={formatPublicManufacturerModel(data.manufacturer, data.model)}
              />
              <InfoRow label={t('publicDeviceInfo.mdmServer')} value={data.mdmServer || '—'} />
              <InfoRow
                label={t('publicDeviceInfo.agentVersion')}
                value={data.agentVersion || t('publicDeviceInfo.unknown')}
              />
              <InfoRow
                label={t('publicDeviceInfo.lastSync')}
                value={formatPublicLastSync(data.lastSyncTime)}
              />
              <InfoRow label={t('publicDeviceInfo.deviceId')} value={data.deviceId || deviceId} />
            </dl>
          )}

          <div className="border-t border-[#1f2937] px-6 py-4 text-xs text-[#9ca3af]">
            {t('publicDeviceInfo.footer')}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-t border-[#1f2937] px-6 py-4 first:border-t-0 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.03em] text-[#9ca3af]">{label}</dt>
      <dd className="break-words text-sm leading-relaxed">{value}</dd>
    </div>
  )
}
