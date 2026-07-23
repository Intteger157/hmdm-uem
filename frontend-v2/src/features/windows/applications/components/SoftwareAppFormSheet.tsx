import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { useUpsertSoftwareAppMutation } from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { SoftwareApp } from '@/features/windows/applications/types/software-app'
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

const softwareAppFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  version: z.string().optional(),
  downloadUrl: z.string().trim().url('invalidUrl').min(1, 'required'),
  installArgs: z.string().optional(),
})

type SoftwareAppFormValues = z.infer<typeof softwareAppFormSchema>

interface SoftwareAppFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  app: SoftwareApp | null
}

function toFormValues(app: SoftwareApp | null): SoftwareAppFormValues {
  if (!app) {
    return {
      name: '',
      version: '',
      downloadUrl: '',
      installArgs: '/quiet /norestart',
    }
  }

  return {
    name: app.name,
    version: app.version ?? '',
    downloadUrl: app.downloadUrl,
    installArgs: app.installArgs ?? '',
  }
}

export function SoftwareAppFormSheet({ open, onOpenChange, app }: SoftwareAppFormSheetProps) {
  const { t } = useTranslation()
  const isEdit = app != null
  const upsertMutation = useUpsertSoftwareAppMutation()

  const form = useForm<SoftwareAppFormValues>({
    resolver: zodResolver(softwareAppFormSchema),
    defaultValues: toFormValues(null),
  })

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(app))
    }
  }, [open, app, form])

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await upsertMutation.mutateAsync({
        id: app?.id,
        payload: {
          name: values.name.trim(),
          version: values.version?.trim() || undefined,
          downloadUrl: values.downloadUrl.trim(),
          installArgs: values.installArgs?.trim() || undefined,
        },
      })
      toast.success(isEdit ? t('windowsAppCatalog.form.updated') : t('windowsAppCatalog.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('windowsAppCatalog.form.error'))
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('windowsAppCatalog.form.editTitle') : t('windowsAppCatalog.form.createTitle')}
          </SheetTitle>
          <SheetDescription>{t('windowsAppCatalog.form.description')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('windowsAppCatalog.form.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('windowsAppCatalog.form.version')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="downloadUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('windowsAppCatalog.form.downloadUrl')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="installArgs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('windowsAppCatalog.form.installArgs')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{t('windowsAppCatalog.form.installArgsHint')}</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={upsertMutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {isEdit ? t('common.save') : t('windowsAppCatalog.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
