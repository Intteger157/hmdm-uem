import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Key, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DeviceView } from '@/shared/api/types/device'

interface WindowsDeviceBitLockerTabProps {
  device: DeviceView
}

export function WindowsDeviceBitLockerTab({ device }: WindowsDeviceBitLockerTabProps) {
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const recoveryKey = device.bitLockerKey?.trim() ?? ''
  const hasKey = recoveryKey.length > 0

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-4" />
          {t('deviceDetail.bitlocker.title')}
        </CardTitle>
        <CardDescription>{t('deviceDetail.bitlocker.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('deviceDetail.bitlocker.statusLabel')}</span>
          <Badge variant={device.bitlockerStatus === 'on' ? 'default' : 'outline'}>
            {t(`deviceDetail.bitlocker.status.${device.bitlockerStatus ?? 'unknown'}`)}
          </Badge>
        </div>

        {hasKey ? (
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="size-4 text-muted-foreground" />
              {t('deviceDetail.bitlocker.recoveryKey')}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p
                className={`font-mono text-sm leading-relaxed break-all ${
                  showKey ? 'text-foreground' : 'select-none blur-sm'
                }`}
              >
                {recoveryKey}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setShowKey((current) => !current)}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {showKey ? t('deviceDetail.bitlocker.hideKey') : t('deviceDetail.bitlocker.showKey')}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('deviceDetail.bitlocker.noKey')}</p>
        )}
      </CardContent>
    </Card>
  )
}
