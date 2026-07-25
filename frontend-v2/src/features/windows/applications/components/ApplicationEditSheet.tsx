import { Loader2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { uploadSoftwareApp } from '@/features/windows/applications/api/windows-applications-api'
import {
  useDeleteApplicationVersionMutation,
  useSoftwareAppQuery,
  useUpdateSoftwareAppMutation,
} from '@/features/windows/applications/hooks/use-windows-software-apps'
import type { ApplicationVersion } from '@/features/windows/applications/types/software-app'
import { formatLatestVersionLabel } from '@/features/windows/applications/types/software-app'
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
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { toast } from 'sonner'

interface ApplicationEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appId: number | null
}

interface GeneralFormValues {
  name: string
  publisher: string
  description: string
}

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

export function ApplicationEditSheet({ open, onOpenChange, appId }: ApplicationEditSheetProps) {
  const { t } = useTranslation()
  const appQuery = useSoftwareAppQuery(appId, open && appId != null)
  const updateMutation = useUpdateSoftwareAppMutation()
  const versionUploadRef = useRef<HTMLInputElement>(null)
  const [uploadingVersion, setUploadingVersion] = useState(false)
  const [versionOverride, setVersionOverride] = useState('')
  const [publisherOverride, setPublisherOverride] = useState('')
  const [activeTab, setActiveTab] = useState('general')

  const form = useForm<GeneralFormValues>({
    defaultValues: { name: '', publisher: '', description: '' },
  })

  useEffect(() => {
    if (!open) {
      setActiveTab('general')
      setVersionOverride('')
      setPublisherOverride('')
      return
    }
    const app = appQuery.data
    if (app) {
      form.reset({
        name: app.name,
        publisher: app.publisher ?? '',
        description: app.description ?? '',
      })
    }
  }, [open, appQuery.data, form])

  const handleGeneralSubmit = form.handleSubmit(async (values) => {
    if (!appId) {
      return
    }
    try {
      await updateMutation.mutateAsync({
        id: appId,
        payload: {
          name: values.name.trim(),
          publisher: values.publisher.trim(),
          description: values.description.trim(),
        },
      })
      toast.success(t('windowsAppCatalog.form.updated'))
    } catch {
      toast.error(t('windowsAppCatalog.form.error'))
    }
  })

  const handleUploadVersion = async (file: File) => {
    if (!appId || !isSupportedInstaller(file)) {
      toast.error(t('windowsAppCatalog.form.uploadInvalidType'))
      return
    }

    setUploadingVersion(true)
    try {
      const manualVersion = versionOverride.trim()
      const manualPublisher = publisherOverride.trim()
      const result = await uploadSoftwareApp(file, {
        appId,
        ...(manualVersion ? { version: manualVersion } : {}),
        ...(manualPublisher ? { publisher: manualPublisher } : {}),
      })
      setVersionOverride(result.version)
      setPublisherOverride(result.publisher?.trim() ?? publisherOverride)
      await appQuery.refetch()
      toast.success(t('windowsAppCatalog.form.versionUploaded'))
    } catch {
      toast.error(t('windowsAppCatalog.form.uploadError'))
    } finally {
      setUploadingVersion(false)
      if (versionUploadRef.current) {
        versionUploadRef.current.value = ''
      }
    }
  }

  const app = appQuery.data

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden data-[side=right]:w-full data-[side=right]:sm:max-w-4xl"
      >
        <SheetHeader className="shrink-0">
          <SheetTitle>{app?.name ?? t('windowsAppCatalog.form.editTitle')}</SheetTitle>
          <SheetDescription>
            {app ? formatLatestVersionLabel(app) : t('windowsAppCatalog.form.description')}
          </SheetDescription>
        </SheetHeader>

        {appQuery.isLoading ? (
          <div className="flex items-center justify-center px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : null}

        {app ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col px-4 pb-4"
          >
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="general" className="flex-1">
                {t('windowsAppCatalog.form.tabGeneral')}
              </TabsTrigger>
              <TabsTrigger value="versions" className="flex-1">
                {t('windowsAppCatalog.form.tabVersions')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-4">
              <Form {...form}>
                <form onSubmit={(event) => void handleGeneralSubmit(event)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('windowsAppCatalog.form.name')}</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="off" required />
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
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('windowsAppCatalog.form.descriptionLabel')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={4} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <SheetFooter className="px-0">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {t('common.save')}
                    </Button>
                  </SheetFooter>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="versions" className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="edit-app-version" className="text-sm font-medium">
                    {t('windowsAppCatalog.form.version')}
                  </label>
                  <Input
                    id="edit-app-version"
                    value={versionOverride}
                    placeholder={t('windowsAppCatalog.form.autoDetectPlaceholder')}
                    autoComplete="off"
                    disabled={uploadingVersion}
                    onChange={(event) => setVersionOverride(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('windowsAppCatalog.form.versionHint')}</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="edit-app-publisher" className="text-sm font-medium">
                    {t('windowsAppCatalog.form.publisher')}
                  </label>
                  <Input
                    id="edit-app-publisher"
                    value={publisherOverride}
                    placeholder={t('windowsAppCatalog.form.autoDetectPlaceholder')}
                    autoComplete="off"
                    disabled={uploadingVersion}
                    onChange={(event) => setPublisherOverride(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('windowsAppCatalog.form.publisherHint')}</p>
                </div>
              </div>
              <input
                ref={versionUploadRef}
                type="file"
                accept=".exe,.msi"
                className="hidden"
                disabled={uploadingVersion}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    void handleUploadVersion(file)
                  }
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    versionUploadRef.current?.click()
                  }
                }}
                onClick={() => versionUploadRef.current?.click()}
                className={cn(
                  'flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center',
                  uploadingVersion && 'pointer-events-none opacity-70',
                )}
              >
                {uploadingVersion ? (
                  <>
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <p className="text-sm">{t('windowsAppCatalog.form.uploading')}</p>
                  </>
                ) : (
                  <>
                    <Upload className="size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('windowsAppCatalog.form.uploadNewVersion')}</p>
                  </>
                )}
              </div>

              <VersionsTable appId={app.id} versions={app.versions} />
            </TabsContent>
          </Tabs>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function VersionsTable({ appId, versions }: { appId: number; versions: ApplicationVersion[] }) {
  const { t } = useTranslation()
  const deleteMutation = useDeleteApplicationVersionMutation()
  const [deleteTarget, setDeleteTarget] = useState<ApplicationVersion | null>(null)

  const sortedVersions = [...versions].sort(
    (left, right) => Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt),
  )

  const handleDeleteVersion = async () => {
    if (!deleteTarget) {
      return
    }

    try {
      await deleteMutation.mutateAsync({ appId, versionId: deleteTarget.id })
      toast.success(t('windowsAppCatalog.versions.deleteSuccess'))
      setDeleteTarget(null)
    } catch (error: unknown) {
      const status =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined
      toast.error(
        status === 409
          ? t('windowsAppCatalog.versions.deleteInUse')
          : t('windowsAppCatalog.versions.deleteError'),
      )
    }
  }

  if (versions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('windowsAppCatalog.form.noVersions')}</p>
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">
            {t('windowsAppCatalog.form.tabVersions')}
            <span className="ml-1.5 font-normal text-muted-foreground">({sortedVersions.length})</span>
          </h3>
        </div>

        <ul className="divide-y divide-border overflow-hidden rounded-lg border bg-muted/20">
          {sortedVersions.map((version) => (
            <li key={version.id} className="flex items-start gap-2 p-3 sm:gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium tabular-nums">{version.version || '—'}</span>
                  <span className="text-xs text-muted-foreground">{formatTimestamp(version.uploadedAt)}</span>
                </div>
                <div className="text-xs leading-relaxed">
                  <span className="font-medium text-muted-foreground">
                    {t('windowsAppCatalog.columns.installArgs')}
                  </span>
                  <p className="mt-1 break-all font-mono text-[11px] text-foreground/90">
                    {version.installArgs?.trim() || '—'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-destructive hover:text-destructive"
                aria-label={t('windowsAppCatalog.versions.deleteTitle')}
                onClick={() => setDeleteTarget(version)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('windowsAppCatalog.versions.deleteTitle')}
        description={t('windowsAppCatalog.versions.deleteConfirm', {
          version: deleteTarget?.version ?? '',
        })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDeleteVersion()}
      />
    </>
  )
}
