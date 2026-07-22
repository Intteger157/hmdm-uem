import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  fetchConfigurationOptions,
  fetchGroupOptions,
} from '@/features/devices/api/devices-api'
import { useUpsertDeviceMutation } from '@/features/devices/hooks/use-device-mutations'
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
import type { DeviceView, LookupItem } from '@/shared/api/types/device'
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
  groupOptions?: LookupItem[]
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
      const defaultConfigId = configurationsQuery.data?.[0]?.id ?? 0
      form.reset({
        number: '',
        description: '',
        configurationId: defaultConfigId,
        groupIds: [],
      })
    }
  }, [open, device, form, configurationsQuery.data])

  const onSubmit = async (values: DeviceFormValues) => {
    try {
      const groups = values.groupIds
        .map((id) => groupOptions.find((g) => g.id === id))
        .filter((g): g is LookupItem => g != null)

      await upsertMutation.mutateAsync({
        id: device?.id,
        number: values.number.trim(),
        description: values.description?.trim() || undefined,
        configurationId: values.configurationId,
        groups,
      })

      toast.success(isEdit ? t('devices.form.updated') : t('devices.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('devices.form.error'))
    }
  }

  const configurations = configurationsQuery.data ?? []

  return (
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
                    <Input {...field} autoComplete="off" />
                  </FormControl>
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
                      value={field.value || ''}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    >
                      <option value="" disabled>
                        {t('devices.form.selectConfiguration')}
                      </option>
                      {configurations.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                        const checked = field.value.includes(group.id)
                        return (
                          <label
                            key={group.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, group.id])
                                } else {
                                  field.onChange(field.value.filter((id) => id !== group.id))
                                }
                              }}
                            />
                            {group.name}
                          </label>
                        )
                      })}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="border-t-0 bg-transparent p-0 pt-2">
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
  )
}
