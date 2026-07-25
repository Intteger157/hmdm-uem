import { Loader2 } from 'lucide-react'
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

function isNotFoundError(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'response' in error &&
    (error as { response?: { status?: number } }).response?.status === 404
  )
}

export function PublicDeviceInfoPage({ deviceId }: PublicDeviceInfoPageProps) {
  const { t } = useTranslation()
  const { data: device, error, isLoading, isFetching } = usePublicDeviceInfoQuery(deviceId)

  const showLoading = isLoading || (isFetching && !device)
  const errorMessage = isNotFoundError(error)
    ? t('publicDeviceInfo.notFound')
    : t('publicDeviceInfo.loadFailed')

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black">
          <div className="px-6 pt-6">
            <img
              src={laptopImageSrc}
              alt=""
              className="mx-auto mb-6 max-h-52 w-full max-w-sm object-contain"
            />
          </div>

          <div className="border-b border-neutral-800 px-6 pb-6">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-blue-400">
              {t('publicDeviceInfo.badge')}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {t('publicDeviceInfo.title')}
            </h1>
            <p className="mt-2 text-sm text-neutral-400">{t('publicDeviceInfo.subtitle')}</p>
          </div>

          {showLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-neutral-400">
              <Loader2 className="size-4 animate-spin" />
              {t('publicDeviceInfo.loading')}
            </div>
          ) : error != null || !device ? (
            <div className="px-6 py-10 text-sm text-red-400">{errorMessage}</div>
          ) : (
            <dl className="divide-y divide-neutral-800">
              <InfoRow label={t('publicDeviceInfo.computer')} value={device.hostname?.trim() || '—'} />
              <InfoRow
                label={t('publicDeviceInfo.manufacturerModel')}
                value={formatPublicManufacturerModel(
                  device.manufacturer,
                  device.model,
                  t('publicDeviceInfo.unknownDevice'),
                )}
              />
              <InfoRow label={t('publicDeviceInfo.mdmServer')} value={device.mdmServer?.trim() || '—'} />
              <InfoRow
                label={t('publicDeviceInfo.agentVersion')}
                value={device.agentVersion?.trim() || t('publicDeviceInfo.unknown')}
              />
              <InfoRow
                label={t('publicDeviceInfo.lastSync')}
                value={formatPublicLastSync(device.lastSyncTime)}
              />
              <InfoRow
                label={t('publicDeviceInfo.deviceId')}
                value={device.deviceId?.trim() || deviceId.trim() || '—'}
              />
            </dl>
          )}

          <div className="border-t border-neutral-800 px-6 py-4 text-xs text-neutral-400">
            {t('publicDeviceInfo.footer')}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 px-6 py-4 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.03em] text-neutral-400">{label}</dt>
      <dd className="break-words text-sm leading-relaxed text-neutral-200">{value}</dd>
    </div>
  )
}
