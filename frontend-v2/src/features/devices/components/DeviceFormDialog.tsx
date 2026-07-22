import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  fetchConfigurationOptions,
  fetchGroupOptions,
} from '@/features/devices/api/devices-api'
import { useUpsertDeviceMutation } from '@/features/devices/hooks/use-device-mutations'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { DeviceUpsertPayload, DeviceView, SelectOption } from '@/shared/api/types/device'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const deviceFormSchema = z.object({
  number: z
    .string()
    .min(1, 'required')
    .regex(/^[^/?&]+$/, 'invalidNumber'),
  description: z.string().optional(),
  configurationId: z.number().int().positive('required'),
  groupIds: z.array(z.number()),
})

type DeviceFormValues = z.infer<typeof deviceFormSchema>

interface DeviceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: DeviceView | null
  groupOptions?: SelectOption[]
}

function buildUpsertPayload(
  device: DeviceView | null | undefined,
  values: DeviceFormValues,
  groupOptions: SelectOption[],
  migrationOldNumber?: string,
): DeviceUpsertPayload {
  const groups = values.groupIds
    .map((id) => groupOptions.find((g) => Number(g.value) === id))
    .filter((g): g is SelectOption => g != null)
    .map((g) => ({ id: Number(g.value), name: g.label }))

  return {
    id: device?.id,
    number: values.number.trim(),
    description: values.description?.trim() || undefined,
    configurationId: values.configurationId,
    groups,
    oldNumber: migrationOldNumber ?? device?.oldNumber,
  }
}

export function DeviceFormDialog({
  open,
  onOpenChange,
  device,
  groupOptions: groupOptionsProp,
}: DeviceFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = device != null
  const upsertMutation = useUpsertDeviceMutation()
  const [migrationConfirmOpen, setMigrationConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<DeviceFormValues | null>(null)

  const isMigrationInProgress = Boolean(device?.oldNumber)
  const isEnrolled = (device?.lastUpdate ?? 0) > 0

  const configurationsQuery = useQuery({
    queryKey: ['configurations', 'list'],
    queryFn: fetchConfigurationOptions,
    enabled: open,
  })

  const groupsQuery = useQuery({
    queryKey: ['groups', 'list'],
    queryFn: fetchGroupOptions,
    enabled: open && groupOptionsProp == null,
  })

  const groupOptions = groupOptionsProp ?? groupsQuery.data ?? []

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      number: '',
      description: '',
      configurationId: 0,
      groupIds: [],
    },
  })

  useEffect(() => {
    if (!open) {
      setMigrationConfirmOpen(false)
      setPendingValues(null)
      return
    }

    if (device) {
      form.reset({
        number: device.number,
        description: device.description ?? '',
        configurationId: device.configurationId,
        groupIds: device.groups?.map((g) => g.id) ?? [],
      })
    } else {
      const defaultConfigId = Number(configurationsQuery.data?.[0]?.value ?? 0)
      form.reset({
        number: '',
        description: '',
        configurationId: defaultConfigId,
        groupIds: [],
      })
    }
  }, [open, device, form, configurationsQuery.data])

  const saveDevice = async (values: DeviceFormValues, migrationOldNumber?: string) => {
    await upsertMutation.mutateAsync(
      buildUpsertPayload(device, values, groupOptions, migrationOldNumber),
    )
    toast.success(isEdit ? t('devices.form.updated') : t('devices.form.created'))
    onOpenChange(false)
  }

  const onSubmit = async (values: DeviceFormValues) => {
    try {
      const numberChanged = device != null && values.number.trim() !== device.number
      if (numberChanged && isEnrolled) {
        setPendingValues(values)
        setMigrationConfirmOpen(true)
        return
      }

      await saveDevice(values)
    } catch {
      toast.error(t('devices.form.error'))
    }
  }

  const onConfirmMigration = async () => {
    if (!pendingValues || !device) {
      return
    }

    try {
      await saveDevice(pendingValues, device.number)
      setMigrationConfirmOpen(false)
      setPendingValues(null)
    } catch {
      toast.error(t('devices.form.error'))
    }
  }

  const configurations = configurationsQuery.data ?? []
  const optionsLoading = configurationsQuery.isLoading || groupsQuery.isLoading

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? t('devices.form.editTitle') : t('devices.form.addTitle')}
            </DialogTitle>
            <DialogDescription>
              {isEdit ? t('devices.form.editDescription') : t('devices.form.addDescription')}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('devices.form.number')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="off"
                        disabled={isMigrationInProgress}
                        title={
                          isMigrationInProgress ? t('devices.form.numberLocked') : undefined
                        }
                      />
                    </FormControl>
                    {isMigrationInProgress && (
                      <p className="text-xs text-muted-foreground">{t('devices.form.numberLocked')}</p>
                    )}
                    <FormMessage>
                      {form.formState.errors.number?.message === 'invalidNumber'
                        ? t('devices.form.invalidNumber')
                        : form.formState.errors.number?.message === 'required'
                          ? t('devices.form.required')
                          : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('devices.form.description')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} className="resize-none" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="configurationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('devices.form.configuration')}</FormLabel>
                    <FormControl>
                      <select
                        className={cn(
                          'flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm',
                        )}
                        value={field.value ? String(field.value) : ''}
                        disabled={optionsLoading || configurations.length === 0}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      >
                        <option value="" disabled>
                          {optionsLoading
                            ? t('devices.form.loadingOptions')
                            : t('devices.form.selectConfiguration')}
                        </option>
                        {configurations.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage>
                      {form.formState.errors.configurationId ? t('devices.form.required') : null}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="groupIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('devices.form.groups')}</FormLabel>
                    <FormControl>
                      <div className="max-h-32 space-y-2 overflow-y-auto rounded-lg border border-input p-3">
                        {groupOptions.length === 0 && (
                          <p className="text-sm text-muted-foreground">{t('devices.form.noGroups')}</p>
                        )}
                        {groupOptions.map((group) => {
                          const groupId = Number(group.value)
                          const checked = field.value.includes(groupId)
                          return (
                            <label
                              key={group.value}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={optionsLoading}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange([...field.value, groupId])
                                  } else {
                                    field.onChange(field.value.filter((id) => id !== groupId))
                                  }
                                }}
                              />
                              {group.label}
                            </label>
                          )
                        })}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {t('devices.form.cancel')}
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? t('devices.form.saving') : t('devices.form.save')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={migrationConfirmOpen}
        onOpenChange={(nextOpen) => {
          setMigrationConfirmOpen(nextOpen)
          if (!nextOpen) {
            setPendingValues(null)
          }
        }}
        title={t('devices.form.migrationTitle')}
        description={t('devices.form.migrationWarning')}
        confirmLabel={t('devices.form.migrationConfirm')}
        pendingLabel={t('devices.form.saving')}
        confirmVariant="default"
        isPending={upsertMutation.isPending}
        onConfirm={() => void onConfirmMigration()}
      />
    </>
  )
}
