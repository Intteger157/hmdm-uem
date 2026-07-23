import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
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
  useWindowsConfigProfileQuery,
  useWindowsDeviceGroupsQuery,
} from '@/features/windows/configurations/hooks/use-windows-config-profiles'
import {
  configProfileFormSchema,
  createEmptyConfigProfileFormValues,
  toConfigProfileFormValues,
  type ConfigProfileFormValues,
} from '@/features/windows/configurations/utils/windows-config-form'
import { BoolField } from '@/shared/components/BoolField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface WindowsConfigEditorPageProps {
  profileId?: number
  isNew?: boolean
}

export function WindowsConfigEditorPage({ profileId, isNew = false }: WindowsConfigEditorPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')

  const profileQuery = useWindowsConfigProfileQuery(isNew ? null : profileId ?? null, !isNew)
  const assignmentsQuery = useWindowsConfigProfileAssignmentsQuery(
    isNew ? null : profileId ?? null,
    !isNew,
  )
  const profileAppsQuery = useConfigProfileAppsQuery(isNew ? null : profileId ?? null, !isNew)

  const upsertMutation = useUpsertWindowsConfigProfileMutation()
  const assignMutation = useAssignWindowsConfigProfileMutation()
  const assignAppsMutation = useAssignConfigProfileAppsMutation()

  const softwareAppsQuery = useSoftwareAppsQuery(true)
  const groupsQuery = useWindowsDeviceGroupsQuery(true)
  const devicesQuery = useQuery({
    queryKey: ['windows-device-options'],
    queryFn: fetchWindowsDeviceOptions,
  })

  const form = useForm<ConfigProfileFormValues>({
    resolver: zodResolver(configProfileFormSchema),
    defaultValues: createEmptyConfigProfileFormValues(),
  })

  const isEdit = !isNew && profileId != null && profileId > 0
  const isLoading =
    isEdit &&
    (profileQuery.isLoading || assignmentsQuery.isLoading || profileAppsQuery.isLoading)
  const loadError =
    isEdit &&
    (profileQuery.error != null ||
      assignmentsQuery.error != null ||
      profileAppsQuery.error != null ||
      !profileQuery.data)

  useEffect(() => {
    if (isNew) {
      form.reset(createEmptyConfigProfileFormValues())
      return
    }

    if (profileQuery.data) {
      form.reset(
        toConfigProfileFormValues(profileQuery.data, assignmentsQuery.data, profileAppsQuery.data),
      )
    }
  }, [isNew, profileQuery.data, assignmentsQuery.data, profileAppsQuery.data, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await upsertMutation.mutateAsync({
        id: profileId,
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

      if (isNew && saved.id) {
        void navigate({
          to: '/windows/configurations/$profileId',
          params: { profileId: String(saved.id) },
          replace: true,
        })
      }
    } catch {
      toast.error(t('windowsConfigurations.form.error'))
    }
  })

  const isPending = upsertMutation.isPending || assignMutation.isPending || assignAppsMutation.isPending
  const profileName = form.watch('name')

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full max-w-3xl" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-8 text-center">
        <p className="text-sm text-destructive">{t('common.loadError')}</p>
        <Button type="button" variant="outline" className="mt-3" render={<Link to="/windows/configurations" />}>
          {t('windowsConfigurations.editor.backToList')}
        </Button>
      </div>
    )
  }

  const pageTitle = isNew
    ? t('windowsConfigurations.editor.newTitle')
    : profileName.trim() || profileQuery.data?.name || t('windowsConfigurations.editor.newTitle')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon-sm" render={<Link to="/windows/configurations" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{t('windowsConfigurations.editor.subtitle')}</p>
          </div>
        </div>
        <Button
          type="submit"
          form="config-form"
          disabled={isPending || !profileName.trim()}
        >
          {isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      <Form {...form}>
        <form id="config-form" onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="general">{t('windowsConfigurations.form.general')}</TabsTrigger>
              <TabsTrigger value="policies">{t('windowsConfigurations.form.securityPolicies')}</TabsTrigger>
              <TabsTrigger value="apps">{t('windowsConfigurations.form.requiredApps')}</TabsTrigger>
              <TabsTrigger value="assignments">{t('windowsConfigurations.form.assignments')}</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('windowsConfigurations.editor.generalTitle')}</CardTitle>
                  <CardDescription>{t('windowsConfigurations.editor.generalDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                          <Textarea {...field} rows={3} className="resize-none" />
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('windowsConfigurations.editor.securityTitle')}</CardTitle>
                  <CardDescription>{t('windowsConfigurations.editor.securityDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                            className="max-w-xs"
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="apps" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('windowsConfigurations.form.requiredApps')}</CardTitle>
                  <CardDescription>{t('windowsConfigurations.requiredApps.hint')}</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assignments" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('windowsConfigurations.form.assignments')}</CardTitle>
                  <CardDescription>{t('windowsConfigurations.assignments.hint')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  )
}
