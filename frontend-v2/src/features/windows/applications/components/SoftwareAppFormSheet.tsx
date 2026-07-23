import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { uploadSoftwareApp } from '@/features/windows/applications/api/windows-applications-api'
import { useUpsertSoftwareAppMutation } from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { SoftwareApp, SoftwareAppType, UpdateFrequency } from '@/features/windows/applications/types/software-app'
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
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const softwareAppFormSchema = z
  .object({
    appType: z.enum(['upload', 'url', 'winget']),
    name: z.string().trim().min(1, 'required'),
    version: z.string().optional(),
    downloadUrl: z.string().optional(),
    wingetId: z.string().optional(),
    installArgs: z.string().optional(),
    autoUpdate: z.boolean(),
    updateFrequency: z.enum(['daily', 'weekly']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.appType === 'winget') {
      if (!data.wingetId?.trim()) {
        ctx.addIssue({ code: 'custom', message: 'required', path: ['wingetId'] })
      }
      return
    }

    const downloadUrl = data.downloadUrl?.trim() ?? ''
    if (!downloadUrl) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['downloadUrl'] })
      return
    }
    if (!z.string().url().safeParse(downloadUrl).success) {
      ctx.addIssue({ code: 'custom', message: 'invalidUrl', path: ['downloadUrl'] })
    }
  })
  .superRefine((data, ctx) => {
    if (data.appType === 'upload' || !data.autoUpdate) {
      return
    }
    if (!data.updateFrequency) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['updateFrequency'] })
    }
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
      appType: 'url',
      name: '',
      version: '',
      downloadUrl: '',
      wingetId: '',
      installArgs: '',
      autoUpdate: false,
      updateFrequency: 'daily',
    }
  }

  return {
    appType: app.appType || 'url',
    name: app.name,
    version: app.version ?? '',
    downloadUrl: app.downloadUrl ?? '',
    wingetId: app.wingetId ?? '',
    installArgs: app.installArgs ?? '',
    autoUpdate: app.autoUpdate ?? false,
    updateFrequency: (app.updateFrequency || 'daily') as UpdateFrequency,
  }
}

function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

function supportsUpdatePolicy(appType: SoftwareAppType): boolean {
  return appType === 'url' || appType === 'winget'
}

export function SoftwareAppFormSheet({ open, onOpenChange, app }: SoftwareAppFormSheetProps) {
  const { t } = useTranslation()
  const isEdit = app != null
  const upsertMutation = useUpsertSoftwareAppMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [downloadUrlLocked, setDownloadUrlLocked] = useState(false)

  const form = useForm<SoftwareAppFormValues>({
    resolver: zodResolver(softwareAppFormSchema),
    defaultValues: toFormValues(null),
  })

  const appType = form.watch('appType')
  const autoUpdate = form.watch('autoUpdate')
  const downloadUrl = form.watch('downloadUrl') ?? ''
  const installerIsMsi = downloadUrl.toLowerCase().includes('.msi')
  const installArgsPlaceholder = installerIsMsi ? '/quiet /norestart' : '/S'

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(app))
      setUploading(false)
      setIsDragging(false)
      setDownloadUrlLocked((app?.appType ?? 'url') === 'upload' && Boolean(app?.downloadUrl))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, app, form])

  const handleUploadFile = async (file: File) => {
    if (!isSupportedInstaller(file)) {
      toast.error(t('windowsAppCatalog.form.uploadInvalidType'))
      return
    }

    setUploading(true)
    try {
      const result = await uploadSoftwareApp(file)
      form.setValue('appType', 'upload', { shouldValidate: true })
      form.setValue('name', result.name, { shouldValidate: true })
      form.setValue('version', result.version ?? '', { shouldValidate: true })
      form.setValue('downloadUrl', result.url, { shouldValidate: true })
      form.setValue('autoUpdate', false)
      setDownloadUrlLocked(true)
    } catch {
      toast.error(t('windowsAppCatalog.form.uploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAppTypeChange = (value: string) => {
    const nextType = value as SoftwareAppType
    form.setValue('appType', nextType, { shouldValidate: true })
    if (nextType === 'upload') {
      form.setValue('autoUpdate', false)
      form.setValue('updateFrequency', 'daily')
    }
    if (nextType !== 'upload') {
      setDownloadUrlLocked(false)
    }
    if (nextType === 'winget') {
      form.setValue('downloadUrl', '')
    }
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await upsertMutation.mutateAsync({
        id: app?.id,
        payload: {
          name: values.name.trim(),
          version: values.version?.trim() || undefined,
          appType: values.appType,
          downloadUrl: values.appType !== 'winget' ? values.downloadUrl?.trim() : undefined,
          wingetId: values.appType === 'winget' ? values.wingetId?.trim() : undefined,
          installArgs: values.appType === 'winget' ? undefined : values.installArgs?.trim() || undefined,
          autoUpdate: supportsUpdatePolicy(values.appType) ? values.autoUpdate : false,
          updateFrequency:
            supportsUpdatePolicy(values.appType) && values.autoUpdate
              ? values.updateFrequency
              : undefined,
        },
      })
      toast.success(isEdit ? t('windowsAppCatalog.form.updated') : t('windowsAppCatalog.form.created'))
      onOpenChange(false)
    } catch {
      toast.error(t('windowsAppCatalog.form.error'))
    }
  })

  const downloadUrlField = (
    <FormField
      control={form.control}
      name="downloadUrl"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('windowsAppCatalog.form.downloadUrl')}</FormLabel>
          <FormControl>
            <Input {...field} autoComplete="off" readOnly={downloadUrlLocked} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const updatePolicySection = supportsUpdatePolicy(appType) ? (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{t('windowsAppCatalog.form.updatePolicy')}</p>
      <FormField
        control={form.control}
        name="autoUpdate"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <BoolField
                id="app-auto-update"
                label={t('windowsAppCatalog.form.autoUpdate')}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      {autoUpdate ? (
        <FormField
          control={form.control}
          name="updateFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('windowsAppCatalog.form.updateFrequency')}</FormLabel>
              <FormControl>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={field.value ?? 'daily'}
                  onChange={(event) => field.onChange(event.target.value as UpdateFrequency)}
                >
                  <option value="daily">{t('windowsAppCatalog.form.updateFrequencyDaily')}</option>
                  <option value="weekly">{t('windowsAppCatalog.form.updateFrequencyWeekly')}</option>
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
    </div>
  ) : null

  const wingetField = (
    <FormField
      control={form.control}
      name="wingetId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('windowsAppCatalog.form.wingetId')}</FormLabel>
          <FormControl>
            <Input {...field} autoComplete="off" placeholder="Google.Chrome" />
          </FormControl>
          <p className="text-xs text-muted-foreground">{t('windowsAppCatalog.form.wingetIdHint')}</p>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const uploadZone = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".exe,.msi"
        className="hidden"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleUploadFile(file)
          }
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) {
            void handleUploadFile(file)
          }
        }}
        className={cn(
          'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30',
          uploading && 'pointer-events-none opacity-70',
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">{t('windowsAppCatalog.form.uploading')}</p>
          </>
        ) : (
          <>
            <Upload className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{t('windowsAppCatalog.form.uploadDropzone')}</p>
            <p className="text-xs text-muted-foreground">{t('windowsAppCatalog.form.uploadHint')}</p>
          </>
        )}
      </div>
      {downloadUrlLocked ? downloadUrlField : null}
    </>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('windowsAppCatalog.form.editTitle') : t('windowsAppCatalog.form.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? t('windowsAppCatalog.form.description') : t('windowsAppCatalog.form.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-1 flex-col gap-4 px-4 pb-4">
            <Tabs value={appType} onValueChange={handleAppTypeChange}>
              <TabsList className="w-full">
                <TabsTrigger value="upload" className="flex-1">
                  {t('windowsAppCatalog.form.sourceUploadFile')}
                </TabsTrigger>
                <TabsTrigger value="url" className="flex-1">
                  {t('windowsAppCatalog.form.sourceDirectUrl')}
                </TabsTrigger>
                <TabsTrigger value="winget" className="flex-1">
                  {t('windowsAppCatalog.form.sourceWinget')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4 space-y-4">
                {uploadZone}
              </TabsContent>

              <TabsContent value="url" className="mt-4 space-y-4">
                {downloadUrlField}
                {updatePolicySection}
              </TabsContent>

              <TabsContent value="winget" className="mt-4 space-y-4">
                {wingetField}
                {updatePolicySection}
              </TabsContent>
            </Tabs>

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
            {appType !== 'winget' ? (
              <FormField
                control={form.control}
                name="installArgs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('windowsAppCatalog.form.installArgs')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} placeholder={installArgsPlaceholder} />
                    </FormControl>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{t('windowsAppCatalog.form.installArgsHintMsi')}</p>
                      <p>{t('windowsAppCatalog.form.installArgsHintExeNsis')}</p>
                      <p>{t('windowsAppCatalog.form.installArgsHintExeInno')}</p>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={upsertMutation.isPending || uploading}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={upsertMutation.isPending || uploading}>
                {isEdit ? t('common.save') : t('windowsAppCatalog.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
