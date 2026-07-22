import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Copy, QrCode, Smartphone } from 'lucide-react'
import {
  buildDeviceQrCodePublicUrl,
  buildQrCodeImageUrl,
} from '@/features/devices/api/devices-api'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { useForceLightTheme } from '@/shared/hooks/use-force-light-theme'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface PublicQrEnrollmentPageProps {
  qrCodeKey: string
  deviceId: string
  deviceName: string
  qrSize: number
}

export function PublicQrEnrollmentPage({
  qrCodeKey,
  deviceId: initialDeviceId,
  deviceName: initialDeviceName,
  qrSize: initialSize,
}: PublicQrEnrollmentPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  useForceLightTheme()

  const [deviceNumber, setDeviceNumber] = useState(initialDeviceId)
  const [useId, setUseId] = useState('')
  const [createOnDemand, setCreateOnDemand] = useState(false)
  const [qrSize] = useState(initialSize)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    setDeviceNumber(initialDeviceId)
  }, [initialDeviceId])

  const displayName =
    initialDeviceName.trim() && initialDeviceName.trim() !== initialDeviceId.trim()
      ? initialDeviceName.trim()
      : ''

  const qrImageUrl = useMemo(
    () =>
      buildQrCodeImageUrl(qrCodeKey, {
        deviceId: deviceNumber.trim() || undefined,
        size: qrSize,
        useId: deviceNumber.trim() ? undefined : useId || undefined,
        create: createOnDemand,
      }),
    [qrCodeKey, deviceNumber, qrSize, useId, createOnDemand],
  )

  const syncUrl = (nextDeviceNumber: string) => {
    void navigate({
      to: '/qr/$qrCodeKey',
      params: { qrCodeKey },
      search: {
        deviceId: nextDeviceNumber,
        name: displayName,
        size: qrSize,
      },
      replace: true,
    })
  }

  const handleDeviceNumberChange = (value: string) => {
    setDeviceNumber(value)
    if (value.trim()) {
      setUseId('')
    }
    syncUrl(value)
    setImageError(false)
  }

  const handleCopyLink = async () => {
    const url = buildDeviceQrCodePublicUrl(qrCodeKey, deviceNumber, {
      size: qrSize,
      name: displayName || undefined,
    })

    try {
      await copyTextToClipboard(url)
    } catch {
      // Best-effort copy.
    }

    toast.success(t('devices.qr.linkCopied'))
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
            <QrCode className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('devices.qr.public.title')}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {t('devices.qr.public.subtitle')}
          </p>
        </div>

        <Card className="w-full gap-0 overflow-hidden border-slate-200/80 py-0 shadow-lg shadow-slate-200/60">
          <CardHeader className="space-y-3 rounded-none border-b border-slate-200 bg-slate-50 px-6 pb-4 pt-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <Smartphone className="size-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <CardTitle className="break-all text-lg">
                  {deviceNumber.trim() || t('devices.qr.public.noDeviceNumber')}
                </CardTitle>
                {displayName ? (
                  <CardDescription className="text-base text-foreground/80">
                    {displayName}
                  </CardDescription>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 px-6 pb-6 pt-6">
            <div className="flex justify-center">
              {!imageError ? (
                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <img
                    key={qrImageUrl}
                    src={qrImageUrl}
                    alt={t('devices.qr.alt', { number: deviceNumber || qrCodeKey })}
                    width={qrSize}
                    height={qrSize}
                    className="size-64 max-w-full object-contain sm:size-[280px]"
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center text-sm text-destructive">
                  {t('devices.qr.loadError')}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="public-qr-device-number">{t('devices.qr.public.deviceNumber')}</Label>
                <Input
                  id="public-qr-device-number"
                  value={deviceNumber}
                  maxLength={100}
                  placeholder={t('devices.qr.public.deviceNumberPlaceholder')}
                  onChange={(e) => handleDeviceNumberChange(e.target.value)}
                />
              </div>

              <FormSelect
                id="public-qr-use-id"
                label={t('devices.qr.public.numberAssignment')}
                value={useId}
                disabled={deviceNumber.trim().length > 0}
                onChange={(value) => {
                  setUseId(value)
                  setImageError(false)
                }}
                hint={t('devices.qr.public.numberHint')}
                options={[
                  { value: '', label: t('devices.qr.public.useRequest') },
                  { value: 'imei', label: t('devices.qr.public.useImei') },
                  { value: 'serial', label: t('devices.qr.public.useSerial') },
                ]}
              />

              <BoolField
                id="public-qr-create"
                label={t('devices.qr.public.autoCreate')}
                checked={createOnDemand}
                onCheckedChange={(checked) => {
                  setCreateOnDemand(checked)
                  setImageError(false)
                }}
              />
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={() => void handleCopyLink()}>
              <Copy className="mr-2 size-4" />
              {t('devices.qr.copyLink')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
