import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useUpsertWindowsConfigProfileMutation } from '@/features/windows/configurations/hooks/use-windows-config-profiles'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const configProfileFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  description: z.string().optional(),
  isActive: z.boolean(),
  payload: z.object({
    defenderEnabled: z.boolean(),
    blockUsbStorage: z.boolean(),
    screenLockTimeout: z.number().int().min(0),
  }),
})

type ConfigProfileFormValues = z.infer<typeof configProfileFormSchema>

interface WindowsConfigProfileFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: WindowsConfigProfile | null
}

function toFormValues(profile: WindowsConfigProfile | null): ConfigProfileFormValues {
  if (!profile) {
    return {
      name: '',
      description: '',
      isActive: false,
      payload: { ...DEFAULT_WINDOWS_CONFIG_PROFILE_PAYLOAD },
    }
  }

  return {
    name: profile.name,
    description: profile.description ?? '',
    isActive: profile.isActive,
    payload: {
      defenderEnabled: profile.payload.defenderEnabled,
      blockUsbStorage: profile.payload.blockUsbStorage,
      screenLockTimeout: profile.payload.screenLockTimeout,
    },
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

  const form = useForm<ConfigProfileFormValues>({
    resolver: zodResolver(configProfileFormSchema),
    defaultValues: toFormValues(null),
  })

  useEffect(() => {
    if (!open) {
      return
    }
    form.reset(toFormValues(profile))
  }, [open, profile, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await upsertMutation.mutateAsync({
        id: profile?.id,
        payload: {
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          isActive: values.isActive,
          payload: values.payload,
        },
      })
      toast.success(isEdit ? t('windowsConfigurations.form.updated') : t('windowsConfigurations.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('windowsConfigurations.form.error'))
    }
  })

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
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-1 flex-col gap-6 px-4 pb-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t('windowsConfigurations.form.general')}</h3>
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
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t('windowsConfigurations.form.securityPolicies')}</h3>
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
            </div>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={upsertMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {isEdit ? t('common.save') : t('windowsConfigurations.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
