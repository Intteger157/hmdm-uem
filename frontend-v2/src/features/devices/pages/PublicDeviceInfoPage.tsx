import { Clock, Fingerprint, Loader2, Server, ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

  const hostname = device?.hostname?.trim()
  const manufacturerModel = device
    ? formatPublicManufacturerModel(
        device.manufacturer,
        device.model,
        t('publicDeviceInfo.unknownDevice'),
      )
    : '—'

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-6 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-indigo-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-slate-800/80 shadow-2xl shadow-black/50 ring-1 ring-white/5">
          <div className="relative bg-black px-5 pt-5 pb-5 sm:px-6">
            <div className="relative mx-auto max-w-xs">
              <div className="absolute inset-x-6 top-6 h-16 rounded-full bg-sky-500/25 blur-3xl" />
              <img
                src={laptopImageSrc}
                alt=""
                className="relative mx-auto h-32 w-full max-w-xs object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.65)]"
              />
            </div>

            <div className="mt-4 space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold tracking-[0.06em] text-sky-300 uppercase">
                <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                {t('publicDeviceInfo.badge')}
              </div>

              <div>
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                  {hostname || t('publicDeviceInfo.title')}
                </h1>
                {hostname ? (
                  <p className="mt-0.5 text-sm text-slate-400">{t('publicDeviceInfo.title')}</p>
                ) : null}
              </div>

              {!showLoading && device && manufacturerModel !== '—' ? (
                <p className="text-sm font-medium text-slate-300">{manufacturerModel}</p>
              ) : null}

              <p className="max-w-prose text-sm leading-snug text-slate-400">
                {t('publicDeviceInfo.subtitle')}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800/80 bg-slate-900/95">
            {showLoading ? (
              <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-slate-400">
                <Loader2 className="size-4 animate-spin" />
                {t('publicDeviceInfo.loading')}
              </div>
            ) : error != null || !device ? (
              <div className="px-6 py-8 text-center text-sm text-red-400">{errorMessage}</div>
            ) : (
              <dl className="divide-y divide-slate-800/80">
                <InfoRow
                  icon={Server}
                  label={t('publicDeviceInfo.mdmServer')}
                  value={device.mdmServer?.trim() || '—'}
                />
                <InfoRow
                  icon={ShieldCheck}
                  label={t('publicDeviceInfo.agentVersion')}
                  value={device.agentVersion?.trim() || t('publicDeviceInfo.unknown')}
                />
                <InfoRow
                  icon={Clock}
                  label={t('publicDeviceInfo.lastSync')}
                  value={formatPublicLastSync(device.lastSyncTime)}
                />
                <InfoRow
                  icon={Fingerprint}
                  label={t('publicDeviceInfo.deviceId')}
                  value={device.deviceId?.trim() || deviceId.trim() || '—'}
                  mono
                />
              </dl>
            )}

            <div className="border-t border-slate-800/80 px-5 py-3 text-center text-xs text-slate-500">
              {t('publicDeviceInfo.footer')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex gap-3 px-5 py-2.5 sm:py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-sky-400">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold tracking-[0.08em] text-slate-500 uppercase">{label}</dt>
        <dd
          className={`mt-0.5 break-words text-sm leading-snug text-slate-100 ${mono ? 'font-mono text-xs text-slate-300' : 'font-medium'}`}
        >
          {value}
        </dd>
      </div>
    </div>
  )
}
