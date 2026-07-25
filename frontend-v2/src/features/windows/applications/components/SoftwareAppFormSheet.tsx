import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { fetchSoftwareApps, uploadSoftwareApp } from '@/features/windows/applications/api/windows-applications-api'
import {
  useCreateApplicationVersionMutation,
  useCreateSoftwareAppMutation,
  useSoftwareAppsQuery,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import {
  getWindowsApiErrorMessage,
  isDuplicateApplicationNameError,
} from '@/features/windows/applications/utils/app-catalog-errors'
import type {
  CreateApplicationVersionPayload,
  SoftwareApp,
  SoftwareAppType,
  UpdateFrequency,
} from '@/features/windows/applications/types/software-app'
import { findSoftwareAppByName } from '@/features/windows/applications/types/software-app'
import { BoolField } from '@/shared/components/BoolField'
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
    publisher: z.string().optional(),
    downloadUrl: z.string().optional(),
    wingetId: z.string().optional(),
    installArgs: z.string().optional(),
    silentInstallation: z.boolean(),
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
  onCreated?: (appId: number) => void
}

const DEFAULT_APP_VERSION = '1.0.0'

function normalizeAppVersion(version?: string | null): string {
  const trimmed = version?.trim() ?? ''
  return trimmed || DEFAULT_APP_VERSION
}

function createDefaultFormValues(): SoftwareAppFormValues {
  return {
    appType: 'upload',
    name: '',
    version: '',
    publisher: '',
    downloadUrl: '',
    wingetId: '',
    installArgs: '',
    silentInstallation: true,
    autoUpdate: false,
    updateFrequency: 'daily',
  }
}

function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

function supportsUpdatePolicy(appType: SoftwareAppType): boolean {
  return appType === 'url' || appType === 'winget'
}

export function SoftwareAppFormSheet({ open, onOpenChange, onCreated }: SoftwareAppFormSheetProps) {
  const { t } = useTranslation()
  const createMutation = useCreateSoftwareAppMutation()
  const versionMutation = useCreateApplicationVersionMutation()
  const appsQuery = useSoftwareAppsQuery(open)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingVersionPayloadRef = useRef<CreateApplicationVersionPayload | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [downloadUrlLocked, setDownloadUrlLocked] = useState(false)
  const [detectedInstallArgs, setDetectedInstallArgs] = useState('')
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicateApp, setDuplicateApp] = useState<SoftwareApp | null>(null)

  const form = useForm<SoftwareAppFormValues>({
    resolver: zodResolver(softwareAppFormSchema),
    defaultValues: createDefaultFormValues(),
  })

  const appType = form.watch('appType')
  const autoUpdate = form.watch('autoUpdate')
  const silentInstallation = form.watch('silentInstallation')
  const appName = form.watch('name') ?? ''
  const appVersion = form.watch('version') ?? ''
  const downloadUrl = form.watch('downloadUrl') ?? ''
  const installerIsMsi = downloadUrl.toLowerCase().includes('.msi')
  const installArgsPlaceholder = installerIsMsi ? '/quiet /norestart' : '/S'

  const existingApp = useMemo(
    () => findSoftwareAppByName(appsQuery.data ?? [], appName),
    [appsQuery.data, appName],
  )

  const isSaving = createMutation.isPending || versionMutation.isPending

  useEffect(() => {
    if (open) {
      form.reset(createDefaultFormValues())
      setUploading(false)
      setIsDragging(false)
      setDownloadUrlLocked(false)
      setDetectedInstallArgs('')
      setDuplicateDialogOpen(false)
      setDuplicateApp(null)
      pendingVersionPayloadRef.current = null
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, form])

  function buildVersionPayload(values: SoftwareAppFormValues): CreateApplicationVersionPayload {
    const resolvedInstallArgs =
      values.appType === 'winget'
        ? undefined
        : values.silentInstallation
          ? detectedInstallArgs.trim() || undefined
          : values.installArgs?.trim() || undefined

    return {
      version: normalizeAppVersion(values.version),
      appType: values.appType,
      downloadUrl: values.appType !== 'winget' ? values.downloadUrl?.trim() : undefined,
      wingetId: values.appType === 'winget' ? values.wingetId?.trim() : undefined,
      installArgs: resolvedInstallArgs,
      autoUpdate: supportsUpdatePolicy(values.appType) ? values.autoUpdate : false,
      updateFrequency:
        supportsUpdatePolicy(values.appType) && values.autoUpdate
          ? values.updateFrequency
          : undefined,
    }
  }

  const addVersionToApp = async (app: SoftwareApp, payload: CreateApplicationVersionPayload) => {
    await versionMutation.mutateAsync({ appId: app.id, payload })
    toast.success(
      t('windowsAppCatalog.form.versionAdded', {
        name: app.name,
        version: payload.version ?? DEFAULT_APP_VERSION,
      }),
    )
    onOpenChange(false)
    onCreated?.(app.id)
  }

  const openDuplicateVersionDialog = (app: SoftwareApp, payload: CreateApplicationVersionPayload) => {
    pendingVersionPayloadRef.current = payload
    setDuplicateApp(app)
    setDuplicateDialogOpen(true)
  }

  const handleConfirmAddVersion = async () => {
    if (!duplicateApp || !pendingVersionPayloadRef.current) {
      return
    }

    try {
      await addVersionToApp(duplicateApp, pendingVersionPayloadRef.current)
      setDuplicateDialogOpen(false)
      setDuplicateApp(null)
      pendingVersionPayloadRef.current = null
    } catch (error) {
      toast.error(getWindowsApiErrorMessage(error, t('windowsAppCatalog.form.error')))
    }
  }

  const handleUploadFile = async (file: File) => {
    if (!isSupportedInstaller(file)) {
      toast.error(t('windowsAppCatalog.form.uploadInvalidType'))
      return
    }

    setUploading(true)
    try {
      const manualVersion = (form.getValues('version') ?? '').trim()
      const manualPublisher = (form.getValues('publisher') ?? '').trim()
      const result = await uploadSoftwareApp(file, {
        ...(manualVersion ? { version: manualVersion } : {}),
        ...(manualPublisher ? { publisher: manualPublisher } : {}),
      })
      form.setValue('appType', 'upload', { shouldValidate: true })
      form.setValue('name', result.name, { shouldValidate: true })
      form.setValue('version', result.version?.trim() ?? '', { shouldValidate: true })
      form.setValue('publisher', result.publisher?.trim() ?? '', { shouldValidate: true })
      form.setValue('downloadUrl', result.url, { shouldValidate: true })
      form.setValue('silentInstallation', true)
      form.setValue('installArgs', '')
      setDetectedInstallArgs(result.detectedArgs ?? '')
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
    const versionPayload = buildVersionPayload(values)
    const trimmedName = values.name.trim()

    if (existingApp) {
      openDuplicateVersionDialog(existingApp, versionPayload)
      return
    }

    try {
      const created = await createMutation.mutateAsync({
        name: trimmedName,
        publisher: values.publisher?.trim() || undefined,
        ...versionPayload,
      })
      toast.success(t('windowsAppCatalog.form.created'))
      onOpenChange(false)
      onCreated?.(created.id)
    } catch (error) {
      const apiMessage = getWindowsApiErrorMessage(error, t('windowsAppCatalog.form.error'))
      if (isDuplicateApplicationNameError(apiMessage)) {
        try {
          const apps = await fetchSoftwareApps()
          const matchedApp = findSoftwareAppByName(apps, trimmedName)
          if (matchedApp) {
            openDuplicateVersionDialog(matchedApp, versionPayload)
            return
          }
        } catch {
          // fall through to generic error toast
        }
      }
      toast.error(
        isDuplicateApplicationNameError(apiMessage)
          ? t('windowsAppCatalog.form.duplicateName')
          : apiMessage,
      )
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
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
      >
        <SheetHeader>
          <SheetTitle>{t('windowsAppCatalog.form.createTitle')}</SheetTitle>
          <SheetDescription>{t('windowsAppCatalog.form.createDescription')}</SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6"
          >
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
              name="publisher"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('windowsAppCatalog.form.publisher')}</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" placeholder={t('windowsAppCatalog.form.autoDetectPlaceholder')} />
                  </FormControl>
                  <FormDescription>{t('windowsAppCatalog.form.publisherHint')}</FormDescription>
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
                    <Input {...field} autoComplete="off" placeholder={t('windowsAppCatalog.form.autoDetectPlaceholder')} />
                  </FormControl>
                  <FormDescription>{t('windowsAppCatalog.form.versionHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {appType !== 'winget' ? (
              <div className="space-y-3">
                <FormField
                  control={form.control}
                  name="silentInstallation"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BoolField
                          id="app-silent-installation"
                          label={t('windowsAppCatalog.form.silentInstallation')}
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked)
                            if (!checked && !form.getValues('installArgs')?.trim() && detectedInstallArgs.trim()) {
                              form.setValue('installArgs', detectedInstallArgs.trim())
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {!silentInstallation ? (
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
              </div>
            ) : null}

            {downloadUrlLocked && appType === 'upload' ? (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200">
                {t('windowsAppCatalog.form.uploadParsed')}
              </div>
            ) : null}

            {existingApp ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
                {t('windowsAppCatalog.form.existingAppHint', {
                  name: existingApp.name,
                  version: normalizeAppVersion(appVersion),
                })}
              </div>
            ) : null}

            <SheetFooter className="mt-auto shrink-0 px-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving || uploading}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || uploading}>
                {existingApp
                  ? t('windowsAppCatalog.form.addVersion')
                  : t('windowsAppCatalog.form.create')}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>

      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('windowsAppCatalog.form.existingAppTitle')}</DialogTitle>
            <DialogDescription>
              {t('windowsAppCatalog.form.existingAppDescription', {
                name: duplicateApp?.name ?? appName.trim(),
                version: normalizeAppVersion(appVersion),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDuplicateDialogOpen(false)}
              disabled={versionMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void handleConfirmAddVersion()} disabled={versionMutation.isPending}>
              {t('windowsAppCatalog.form.addVersionConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
