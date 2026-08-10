import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import {
  WindowsGroupDevicePicker,
  type WindowsGroupDeviceOption,
} from '@/features/windows/groups/components/WindowsGroupDevicePicker'
import {
  useCreateWindowsGroupMutation,
  useUpdateWindowsGroupMutation,
  useWindowsGroupDetailQuery,
} from '@/features/windows/groups/hooks/use-windows-groups'
import type { WindowsGroup } from '@/features/windows/groups/types/windows-group'
import { useWindowsConfigProfilesQuery } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import { searchWindowsDevices } from '@/features/windows/api/windows-api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FlatSelect } from '@/components/ui/flat-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

interface WindowsGroupFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: WindowsGroup | null
}

function formatDeviceLabel(hostname: string, currentUser?: string): string {
  const host = hostname.trim() || '—'
  const user = currentUser?.trim()
  return user ? `${host} · ${user}` : host
}

export function WindowsGroupFormDialog({ open, onOpenChange, group }: WindowsGroupFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = group != null
  const createMutation = useCreateWindowsGroupMutation()
  const updateMutation = useUpdateWindowsGroupMutation()
  const groupDetailQuery = useWindowsGroupDetailQuery(group?.id ?? null, open && isEdit)
  const profilesQuery = useWindowsConfigProfilesQuery()

  const devicesQuery = useQuery({
    queryKey: ['windows-group-form-devices'],
    queryFn: async () => {
      const response = await searchWindowsDevices({ platform: 'windows', pageNum: 1, pageSize: 500 })
      return response.devices.items
    },
    enabled: open,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [configurationId, setConfigurationId] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<number[]>([])

  useEffect(() => {
    if (!open) {
      return
    }

    setName(group?.name ?? '')
    setDescription(group?.description ?? '')
    setConfigurationId(group?.configurationId ? String(group.configurationId) : '')
    setIsDefault(group?.isDefault ?? false)
    setSelectedDeviceIds(group?.deviceIds ?? [])
  }, [open, group])

  useEffect(() => {
    if (!open || !isEdit || !groupDetailQuery.data) {
      return
    }

    setName(groupDetailQuery.data.name)
    setDescription(groupDetailQuery.data.description ?? '')
    setConfigurationId(
      groupDetailQuery.data.configurationId ? String(groupDetailQuery.data.configurationId) : '',
    )
    setIsDefault(groupDetailQuery.data.isDefault ?? false)
    setSelectedDeviceIds(groupDetailQuery.data.deviceIds ?? [])
  }, [open, isEdit, groupDetailQuery.data])

  const configurationOptions = useMemo(() => {
    const profiles = profilesQuery.data ?? []
    return [
      { value: '', label: t('windowsGroups.form.configurationUnassigned') },
      ...profiles.map((profile) => ({
        value: String(profile.id),
        label: profile.name,
      })),
    ]
  }, [profilesQuery.data, t])

  const deviceOptions = useMemo((): WindowsGroupDeviceOption[] => {
    return (devicesQuery.data ?? []).map((device) => ({
      id: device.id,
      label: formatDeviceLabel(device.hostname ?? device.number, device.currentUser),
    }))
  }, [devicesQuery.data])

  const isLoadingForm = isEdit && groupDetailQuery.isLoading
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    const parsedConfigurationId = configurationId.trim()
      ? Number.parseInt(configurationId, 10)
      : null

    const payload = {
      name: trimmedName,
      description: description.trim() || undefined,
      isDefault,
      configurationId:
        parsedConfigurationId != null && Number.isInteger(parsedConfigurationId) && parsedConfigurationId > 0
          ? parsedConfigurationId
          : null,
      deviceIds: selectedDeviceIds,
    }

    try {
      if (isEdit && group) {
        await updateMutation.mutateAsync({ id: group.id, payload })
        toast.success(t('windowsGroups.form.updated'))
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(t('windowsGroups.form.created'))
      }
      onOpenChange(false)
    } catch {
      toast.error(t('windowsGroups.form.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#111] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('windowsGroups.form.editTitle') : t('windowsGroups.form.createTitle')}
          </DialogTitle>
          <DialogDescription>{t('windowsGroups.form.description')}</DialogDescription>
        </DialogHeader>

        {isLoadingForm ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="windows-group-name">{t('windowsGroups.form.nameLabel')}</Label>
              <Input
                id="windows-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                className="border-white/10 bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="windows-group-description">{t('windowsGroups.form.descriptionLabel')}</Label>
              <Textarea
                id="windows-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="border-white/10 bg-black/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="windows-group-configuration">{t('windowsGroups.form.configurationLabel')}</Label>
              {profilesQuery.isLoading ? (
                <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <FlatSelect
                  id="windows-group-configuration"
                  value={configurationId}
                  onChange={setConfigurationId}
                  options={configurationOptions}
                  placeholder={t('windowsGroups.form.configurationPlaceholder')}
                />
              )}
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="windows-group-is-default" className="text-sm font-medium">
                  {t('windowsGroups.form.isDefault')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('windowsGroups.form.isDefaultHint')}</p>
              </div>
              <Switch
                id="windows-group-is-default"
                checked={isDefault}
                onCheckedChange={setIsDefault}
                className={isDefault ? 'bg-violet-600 hover:bg-violet-600' : undefined}
              />
            </div>

            <WindowsGroupDevicePicker
              id="windows-group-devices"
              label={t('windowsGroups.form.devicesLabel')}
              options={deviceOptions}
              selectedIds={selectedDeviceIds}
              onChange={setSelectedDeviceIds}
              isLoading={devicesQuery.isLoading}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={isPending || isLoadingForm || !name.trim()}
            onClick={() => void handleSave()}
          >
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
