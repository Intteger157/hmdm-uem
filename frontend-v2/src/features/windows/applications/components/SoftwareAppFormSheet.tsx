import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { uploadSoftwareApp } from '@/features/windows/applications/api/windows-applications-api'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const softwareAppFormSchema = z.object({
  name: z.string().trim().min(1, 'required'),
  version: z.string().optional(),
  downloadUrl: z.string().trim().url('invalidUrl').min(1, 'required'),
  installArgs: z.string().optional(),
})

type SoftwareAppFormValues = z.infer<typeof softwareAppFormSchema>
type SourceMode = 'url' | 'upload'

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

function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

export function SoftwareAppFormSheet({ open, onOpenChange, app }: SoftwareAppFormSheetProps) {
  const { t } = useTranslation()
  const isEdit = app != null
  const upsertMutation = useUpsertSoftwareAppMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [sourceMode, setSourceMode] = useState<SourceMode>('url')
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [downloadUrlLocked, setDownloadUrlLocked] = useState(false)

  const form = useForm<SoftwareAppFormValues>({
    resolver: zodResolver(softwareAppFormSchema),
    defaultValues: toFormValues(null),
  })

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(app))
      setSourceMode('url')
      setUploading(false)
      setIsDragging(false)
      setDownloadUrlLocked(false)
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
      form.setValue('name', result.name, { shouldValidate: true })
      form.setValue('version', result.version ?? '', { shouldValidate: true })
      form.setValue('downloadUrl', result.url, { shouldValidate: true })
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

  const handleSourceModeChange = (value: string) => {
    const mode = value as SourceMode
    setSourceMode(mode)
    if (mode === 'url') {
      setDownloadUrlLocked(false)
    }
  }

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
            {!isEdit ? (
              <Tabs value={sourceMode} onValueChange={handleSourceModeChange}>
                <TabsList className="w-full">
                  <TabsTrigger value="url" className="flex-1">
                    {t('windowsAppCatalog.form.sourceDirectUrl')}
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="flex-1">
                    {t('windowsAppCatalog.form.sourceUploadFile')}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="mt-4">
                  {downloadUrlField}
                </TabsContent>

                <TabsContent value="upload" className="mt-4 space-y-4">
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
                </TabsContent>
              </Tabs>
            ) : (
              downloadUrlField
            )}

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
