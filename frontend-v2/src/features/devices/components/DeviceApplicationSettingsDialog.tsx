import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { ApplicationSettingDialog } from '@/features/configurations/components/editor/ApplicationSettingDialog'
import type { ApplicationSetting } from '@/features/configurations/types/configuration'
import { fetchApplications } from '@/features/applications/api/applications-api'
import {
  fetchDeviceApplicationSettings,
  notifyDeviceApplicationSettings,
  saveDeviceApplicationSettings,
} from '@/features/devices/api/device-plugins-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface DeviceApplicationSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceId?: number
  deviceNumber?: string
}

function settingKey(setting: ApplicationSetting): string {
  return String(setting.id ?? setting.tempId ?? `${setting.applicationPkg}-${setting.name}`)
}

export function DeviceApplicationSettingsDialog({
  open,
  onOpenChange,
  deviceId,
  deviceNumber,
}: DeviceApplicationSettingsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState<ApplicationSetting[]>([])
  const [filter, setFilter] = useState('')
  const [editingSetting, setEditingSetting] = useState<ApplicationSetting | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['device-application-settings', deviceId],
    queryFn: () => fetchDeviceApplicationSettings(deviceId!),
    enabled: open && deviceId != null,
  })

  const applicationsQuery = useQuery({
    queryKey: ['applications'],
    queryFn: fetchApplications,
    enabled: open,
  })

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data)
    }
  }, [settingsQuery.data])

  const filteredSettings = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    if (!needle) {
      return settings
    }
    return settings.filter((setting) =>
      [setting.applicationPkg, setting.applicationName, setting.name, setting.value, setting.comment]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [filter, settings])

  const saveMutation = useMutation({
    mutationFn: () => saveDeviceApplicationSettings(deviceId!, settings),
    onSuccess: async () => {
      toast.success(t('devices.appSettings.saveSuccess'))
      await queryClient.invalidateQueries({ queryKey: ['device-application-settings', deviceId] })
      onOpenChange(false)
    },
    onError: () => toast.error(t('devices.appSettings.error')),
  })

  const notifyMutation = useMutation({
    mutationFn: () => notifyDeviceApplicationSettings(deviceId!),
    onSuccess: () => toast.success(t('devices.appSettings.notifySuccess')),
    onError: () => toast.error(t('devices.appSettings.error')),
  })

  const handleSaveSetting = (setting: ApplicationSetting) => {
    setSettings((current) => {
      const index = current.findIndex((item) => settingKey(item) === settingKey(setting))
      if (index >= 0) {
        const next = [...current]
        next[index] = setting
        return next
      }
      return [...current, { ...setting, tempId: setting.tempId ?? Date.now() }]
    })
    setEditorOpen(false)
    setEditingSetting(null)
  }

  const handleRemoveSetting = (setting: ApplicationSetting) => {
    setSettings((current) => current.filter((item) => settingKey(item) !== settingKey(setting)))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t('devices.actionsMenu.appSettings')}</DialogTitle>
            <DialogDescription>
              {t('devices.appSettings.subtitle', { device: deviceNumber ?? '—' })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder={t('devices.appSettings.filterPlaceholder')}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingSetting(null)
                  setEditorOpen(true)
                }}
              >
                {t('common.add')}
              </Button>
            </div>

            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t('devices.appSettings.columns.pkg')}</th>
                    <th className="px-3 py-2 font-medium">{t('devices.appSettings.columns.name')}</th>
                    <th className="px-3 py-2 font-medium">{t('devices.appSettings.columns.key')}</th>
                    <th className="px-3 py-2 font-medium">{t('devices.appSettings.columns.value')}</th>
                    <th className="px-3 py-2 font-medium">{t('devices.appSettings.columns.comment')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSettings.map((setting) => (
                    <tr key={settingKey(setting)} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{setting.applicationPkg ?? '—'}</td>
                      <td className="px-3 py-2">{setting.applicationName ?? '—'}</td>
                      <td className="px-3 py-2">{setting.name ?? '—'}</td>
                      <td className="px-3 py-2">{setting.value ?? '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{setting.comment ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSetting(setting)
                              setEditorOpen(true)
                            }}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleRemoveSetting(setting)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!settingsQuery.isLoading && filteredSettings.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        {t('devices.appSettings.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={notifyMutation.isPending || deviceId == null}
              onClick={() => void notifyMutation.mutate()}
            >
              {t('devices.appSettings.notify')}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending || deviceId == null}
                onClick={() => void saveMutation.mutate()}
              >
                {t('common.save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApplicationSettingDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        setting={editingSetting}
        applications={applicationsQuery.data ?? []}
        onSave={handleSaveSetting}
      />
    </>
  )
}
