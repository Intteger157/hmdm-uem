import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { fetchWindowsDeviceOptions } from '@/features/windows/configurations/api/windows-configurations-api'
import { WindowsAssignmentMultiSelect } from '@/features/windows/configurations/components/WindowsAssignmentMultiSelect'
import {
  useAssignConfigProfileAppsMutation,
  useConfigProfileAppsQuery,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import {
  useAssignWindowsConfigProfileMutation,
  useUpsertWindowsConfigProfileMutation,
  useWindowsConfigProfileAssignmentsQuery,
  useWindowsDeviceGroupsQuery,
} from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import {
  DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD,
  type WindowsConfigProfile,
} from '@/features/windows/configurations/types/config-profile'
import { BoolField } from '@/shared/components/BoolField'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const configProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  payload: z.object({
    defenderEnabled: z.boolean(),
    blockUsbStorage: z.boolean(),
    usbReadOnly: z.boolean(),
    screenLockTimeout: z.number().int().min(0),
  }),
  groupIds: z.array(z.number().int().positive()),
  deviceIds: z.array(z.number().int().positive()),
  appIds: z.array(z.number().int().positive()),
})

type ConfigProfileFormValues = z.infer<typeof configProfileFormSchema>

interface WindowsConfigProfileFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: WindowsConfigProfile | null
}

function toFormValues(
  profile: WindowsConfigProfile | null,
  assignments?: { groupIds: number[]; deviceIds: number[] },
  profileApps?: { appIds: number[] },
): ConfigProfileFormValues {
  if (!profile) {
    return {
      name: '',
      description: '',
      isActive: false,
      payload: { ...DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD },
      groupIds: [],
      deviceIds: [],
      appIds: [],
    }
  }

  return {
    name: profile.name,
    description: profile.description ?? '',
    isActive: profile.isActive,
    payload: {
      defenderEnabled: profile.payload.defenderEnabled,
      blockUsbStorage: profile.payload.blockUsbStorage,
      usbReadOnly: profile.payload.usbReadOnly ?? false,
      screenLockTimeout: profile.payload.screenLockTimeout,
    },
    groupIds: assignments?.groupIds ?? [],
    deviceIds: assignments?.deviceIds ?? [],
    appIds: profileApps?.appIds ?? [],
  }
}

export function WindowsConfigProfileFormSheet({
  open,
  onOpenChange,
  profile,
}: WindowsConfigProfileFormSheetProps) {
  const { t } = useTranslation()
  const isEdit = profile != null
  const upsertMutation = useUpsertWindowsConfigProfileMutation()
  const assignMutation = useAssignWindowsConfigProfileMutation()
  const assignAppsMutation = useAssignConfigProfileAppsMutation()
  const [activeTab, setActiveTab] = useState('general')

  const assignmentsQuery = useWindowsConfigProfileAssignmentsQuery(profile?.id ?? null, open && isEdit)
  const profileAppsQuery = useConfigProfileAppsQuery(profile?.id ?? null, open && isEdit)
  const softwareAppsQuery = useSoftwareAppsQuery(open)
  const groupsQuery = useWindowsDeviceGroupsQuery(open)
  const devicesQuery = useQuery({
    queryKey: ['windows-device-options'],
    queryFn: fetchWindowsDeviceOptions,
    enabled: open,
  })

  const form = useForm<ConfigProfileFormValues>({
    resolver: zodResolver(configProfileFormSchema),
    defaultValues: toFormValues(null),
  })

  useEffect(() => {
    if (!open) {
      setActiveTab('general')
      return
    }
    form.reset(toFormValues(profile, assignmentsQuery.data, profileAppsQuery.data))
  }, [open, profile, assignmentsQuery.data, profileAppsQuery.data, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await upsertMutation.mutateAsync({
        id: profile?.id,
        payload: {
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          isActive: values.isActive,
          payload: values.payload,
        },
      })

      await assignMutation.mutateAsync({
        profileId: saved.id,
        assignments: {
          groupIds: values.groupIds,
          deviceIds: values.deviceIds,
        },
      })

      await assignAppsMutation.mutateAsync({
        profileId: saved.id,
        appIds: values.appIds,
      })

      toast.success(isEdit ? t('windowsConfigurations.form.updated') : t('windowsConfigurations.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('windowsConfigurations.form.error'))
    }
  })

  const isPending = upsertMutation.isPending || assignMutation.isPending || assignAppsMutation.isPending
  const groupOptions = (groupsQuery.data ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }))
  const deviceOptions = (devicesQuery.data ?? []).map((device) => ({
    value: device.id,
    label: device.label,
  }))
  const appOptions = (softwareAppsQuery.data ?? []).map((app) => ({
    value: app.id,
    label: app.version ? `${app.name} (${app.version})` : app.name,
  }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('windowsConfigurations.form.editTitle') : t('windowsConfigurations.form.createTitle')}
          </SheetTitle>
          <SheetDescription>{t('windowsConfigurations.form.description')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">{t('windowsConfigurations.form.general')}</TabsTrigger>
                <TabsTrigger value="policies">{t('windowsConfigurations.form.securityPolicies')}</TabsTrigger>
                <TabsTrigger value="apps">{t('windowsConfigurations.form.requiredApps')}</TabsTrigger>
                <TabsTrigger value="assignments">{t('windowsConfigurations.form.assignments')}</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('windowsConfigurations.form.name')}</FormLabel>
                      <FormControl>
                        <Input {...field} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('windowsConfigurations.form.descriptionField')}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BoolField
                          id="windows-config-is-active"
                          label={t('windowsConfigurations.form.isActive')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="policies" className="mt-4 space-y-4">
                <FormField
                  control={form.control}
                  name="payload.defenderEnabled"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BoolField
                          id="windows-config-defender"
                          label={t('windowsConfigurations.form.defenderEnabled')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payload.blockUsbStorage"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BoolField
                          id="windows-config-usb"
                          label={t('windowsConfigurations.form.blockUsbStorage')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payload.usbReadOnly"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BoolField
                          id="windows-config-usb-readonly"
                          label={t('windowsConfigurations.form.usbReadOnly')}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payload.screenLockTimeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('windowsConfigurations.form.screenLockTimeout')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10)
                            field.onChange(Number.isNaN(parsed) ? 0 : parsed)
                          }}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t('windowsConfigurations.form.screenLockTimeoutHint')}
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="apps" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">{t('windowsConfigurations.requiredApps.hint')}</p>
                <FormField
                  control={form.control}
                  name="appIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <WindowsAssignmentMultiSelect
                          id="windows-config-apps"
                          label={t('windowsConfigurations.requiredApps.apps')}
                          options={appOptions}
                          selectedIds={field.value}
                          onChange={field.onChange}
                          disabled={isPending || softwareAppsQuery.isLoading}
                          emptyLabel={t('windowsConfigurations.requiredApps.noApps')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="assignments" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">{t('windowsConfigurations.assignments.hint')}</p>
                <FormField
                  control={form.control}
                  name="groupIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <WindowsAssignmentMultiSelect
                          id="windows-config-groups"
                          label={t('windowsConfigurations.assignments.groups')}
                          options={groupOptions}
                          selectedIds={field.value}
                          onChange={field.onChange}
                          disabled={isPending || groupsQuery.isLoading}
                          emptyLabel={t('windowsConfigurations.assignments.noGroups')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deviceIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <WindowsAssignmentMultiSelect
                          id="windows-config-devices"
                          label={t('windowsConfigurations.assignments.devices')}
                          options={deviceOptions}
                          selectedIds={field.value}
                          onChange={field.onChange}
                          disabled={isPending || devicesQuery.isLoading}
                          emptyLabel={t('windowsConfigurations.assignments.noDevices')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isEdit ? t('common.save') : t('windowsConfigurations.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
