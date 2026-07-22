import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import {
  saveAndroidApplicationRequest,
  SaveAndroidApplicationError,
  uploadApkFile,
  type Application,
  type ApkFileDetails,
} from '@/features/applications/api/applications-api'
import type { ConfigurationApplication } from '@/features/configurations/types/configuration'
import { ApiError } from '@/shared/api/types/api-response'
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
import { Label } from '@/components/ui/label'
import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from '@/components/ui/progress'
import { toast } from 'sonner'

interface ApplicationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeOnSave?: boolean
  /** When adding a version to an existing application. */
  parentApplication?: Application
  /** Applications list page — app repository saved. */
  onSavedApplication?: (app: Application, createdNewVersion: boolean) => void
  /** Configuration editor — assign to configuration. */
  onSavedForConfiguration?: (app: ConfigurationApplication) => void
}

const emptyApplication = (): Application => ({
  name: '',
  type: 'app',
  showIcon: false,
  system: false,
  runAfterInstall: false,
  runAtBoot: false,
  arch: '',
})

export function ApplicationFormDialog({
  open,
  onOpenChange,
  closeOnSave = true,
  parentApplication,
  onSavedApplication,
  onSavedForConfiguration,
}: ApplicationFormDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [application, setApplication] = useState<Application>(emptyApplication())
  const [filePath, setFilePath] = useState<string | undefined>()
  const [fileName, setFileName] = useState<string | undefined>()
  const [fileSelected, setFileSelected] = useState(false)
  const [parsedPkg, setParsedPkg] = useState<string | undefined>()
  const [parsedVersion, setParsedVersion] = useState<string | undefined>()
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | undefined>()
  const [warning, setWarning] = useState<string | undefined>()
  const [successHint, setSuccessHint] = useState<string | undefined>()
  const [uploadComplete, setUploadComplete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const resetForm = () => {
    setApplication(emptyApplication())
    setFilePath(undefined)
    setFileName(undefined)
    setFileSelected(false)
    setParsedPkg(undefined)
    setParsedVersion(undefined)
    setUploadProgress(null)
    setUploadMessage(undefined)
    setWarning(undefined)
    setSuccessHint(undefined)
    setUploadComplete(false)
    setSaving(false)
    setErrorMessage(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    if (parentApplication) {
      setApplication({
        ...emptyApplication(),
        name: parentApplication.name,
        pkg: parentApplication.pkg,
        type: parentApplication.type ?? 'app',
        system: parentApplication.system,
        showIcon: parentApplication.showIcon,
        runAfterInstall: parentApplication.runAfterInstall,
        runAtBoot: parentApplication.runAtBoot,
      })
      setFilePath(undefined)
      setFileName(undefined)
      setFileSelected(false)
      setParsedPkg(undefined)
      setParsedVersion(undefined)
      setErrorMessage(undefined)
      setWarning(undefined)
      setSuccessHint(undefined)
      setUploadComplete(false)
    }
  }, [open, parentApplication])

  const applyUploadResult = (
    details: ApkFileDetails,
    existing?: Application,
    meta?: { exists?: boolean; complete?: boolean }
  ) => {
    setApplication((prev) => ({
      ...prev,
      pkg: details.pkg ?? prev.pkg,
      name: existing?.name || details.name || prev.name,
      version: details.version ?? prev.version,
      versionCode: details.versionCode ?? prev.versionCode,
      arch: details.arch ?? prev.arch ?? '',
      ...(existing
        ? {
            showIcon: existing.showIcon ?? prev.showIcon,
            useKiosk: existing.useKiosk ?? prev.useKiosk,
            runAfterInstall: existing.runAfterInstall ?? prev.runAfterInstall,
            runAtBoot: existing.runAtBoot ?? prev.runAtBoot,
            system: existing.system ?? prev.system,
          }
        : {}),
    }))

    if (details.pkg) {
      setParsedPkg(`${details.pkg} - ${t('configurations.editor.fromFile')}`)
    }
    if (details.version) {
      setParsedVersion(`${details.version} - ${t('configurations.editor.fromFile')}`)
    }

    setWarning(undefined)
    setSuccessHint(undefined)

    if (meta?.exists) {
      setWarning(t('configurations.editor.versionExistsWarning'))
    } else if (meta?.complete) {
      setSuccessHint(t('configurations.editor.archCompleteSuccess'))
      setUploadComplete(true)
    } else if (details.arch) {
      setWarning(t('configurations.editor.archWarning', { arch: details.arch }))
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    if (!file.name.endsWith('.apk') && !file.name.endsWith('.xapk')) {
      setErrorMessage(t('configurations.editor.apkRequired'))
      return
    }

    setErrorMessage(undefined)
    setUploadMessage(t('configurations.editor.uploadingFile'))
    setUploadProgress(0)
    setFileName(file.name)

    try {
      const result = await uploadApkFile(file, (loaded, total) => {
        setUploadProgress(Math.round((loaded / total) * 100))
        const loadedMb = (loaded / 1048576).toFixed(1)
        const totalMb = (total / 1048576).toFixed(1)
        setUploadMessage(`${t('configurations.editor.uploadingFile')} ${loadedMb} / ${totalMb} Mb`)
      })

      setFilePath(result.serverPath)
      setFileSelected(true)
      setUploadProgress(null)
      setUploadMessage(t('configurations.editor.fileUploaded'))

      if (result.fileDetails) {
        applyUploadResult(result.fileDetails, result.application, {
          exists: result.exists,
          complete: result.complete,
        })
      }
    } catch (error) {
      setUploadProgress(null)
      setUploadMessage(undefined)
      if (error instanceof ApiError) {
        setErrorMessage(error.messageKey ?? t('configurations.editor.apkParseError'))
      } else if (axios.isAxiosError(error)) {
        if (error.response?.status === 413) {
          setErrorMessage(t('configurations.editor.apkUploadTooLarge'))
        } else {
          setErrorMessage(t('configurations.editor.apkParseError'))
        }
      } else {
        setErrorMessage(t('configurations.editor.apkParseError'))
      }
    }
  }

  const clearFile = () => {
    setFilePath(undefined)
    setFileName(undefined)
    setFileSelected(false)
    setParsedPkg(undefined)
    setParsedVersion(undefined)
    setUploadProgress(null)
    setUploadMessage(undefined)
    setWarning(undefined)
    setSuccessHint(undefined)
    setUploadComplete(false)
    setApplication((prev) => ({
      ...prev,
      pkg: undefined,
      version: undefined,
      versionCode: undefined,
      arch: '',
    }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const buildSaveRequest = (): Application => {
    const request: Application = {
      ...application,
      name: application.name.trim(),
      pkg: application.pkg?.trim(),
      version: application.version?.trim(),
      type: 'app',
      ...(filePath ? { filePath } : {}),
    }

    if (parentApplication) {
      delete request.id
    }

    return request
  }

  const handleSave = async () => {
    setErrorMessage(undefined)

    if (!application.name.trim()) {
      setErrorMessage(t('configurations.editor.errorEmptyAppName'))
      return
    }
    if (!application.pkg && !fileSelected) {
      setErrorMessage(t('configurations.editor.errorEmptyAppPkg'))
      return
    }
    if (!application.version && !fileSelected) {
      setErrorMessage(t('configurations.editor.errorEmptyAppVersion'))
      return
    }

    const request = buildSaveRequest()
    setSaving(true)

    try {
      const result = await saveAndroidApplicationRequest(request, {
        fileSelected,
        uploadComplete,
      })

      if (result.createdNewVersion) {
        toast.success(t('applications.versionAdded'))
      } else {
        toast.success(t('configurations.editor.appSaved'))
      }

      onSavedApplication?.(result.application, result.createdNewVersion)

      if (onSavedForConfiguration) {
        onSavedForConfiguration({
          ...result.application,
          action: 1,
          actionChanged: true,
          isNew: true,
          usedVersionId: result.versionId ?? result.application.latestVersion,
          version: result.application.version ?? request.version,
        })
      }

      if (closeOnSave) {
        handleOpenChange(false)
      }
    } catch (error) {
      if (error instanceof SaveAndroidApplicationError) {
        if (error.code === 'VERSION_TOO_OLD') {
          setErrorMessage(t('applications.errorVersionTooOld'))
        } else if (error.code === 'VERSION_EXISTS') {
          setErrorMessage(t('configurations.editor.versionExistsWarning'))
        } else {
          setErrorMessage(t('configurations.editor.appSaveError'))
        }
      } else {
        setErrorMessage(t('configurations.editor.appSaveError'))
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {parentApplication
              ? t('applications.versions.addVersionTitle', { name: parentApplication.name })
              : t('configurations.editor.newApplicationTitle')}
          </DialogTitle>
          <DialogDescription>
            {parentApplication
              ? t('applications.versions.addVersionDescription')
              : t('configurations.editor.newApplicationDescription')}
          </DialogDescription>
        </DialogHeader>

        {(uploadMessage || errorMessage) && (
          <div className="space-y-2">
            {uploadMessage && (
              <p className="text-sm text-green-700 dark:text-green-300">{uploadMessage}</p>
            )}
            {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
          </div>
        )}

        {uploadProgress != null && (
          <Progress value={uploadProgress}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
            <ProgressValue />
          </Progress>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-pkg">{t('configurations.editor.fields.packageId')}</Label>
            {fileSelected && parsedPkg ? (
              <Input id="app-pkg" value={parsedPkg} disabled />
            ) : (
              <Input
                id="app-pkg"
                value={application.pkg ?? ''}
                placeholder={t('configurations.editor.packageIdPlaceholder')}
                onChange={(e) => setApplication((prev) => ({ ...prev, pkg: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-name">{t('applications.columns.name')}</Label>
            <Input
              id="app-name"
              value={application.name}
              placeholder={t('configurations.editor.appNamePlaceholder')}
              onChange={(e) => setApplication((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-version">{t('applications.columns.version')}</Label>
            {fileSelected && parsedVersion ? (
              <Input id="app-version" value={parsedVersion} disabled />
            ) : (
              <Input
                id="app-version"
                value={application.version ?? ''}
                placeholder={t('configurations.editor.versionPlaceholder')}
                onChange={(e) => setApplication((prev) => ({ ...prev, version: e.target.value }))}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-arch">{t('configurations.editor.fields.nativeCode')}</Label>
            <select
              id="app-arch"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={application.arch ?? ''}
              onChange={(e) => setApplication((prev) => ({ ...prev, arch: e.target.value }))}
            >
              <option value="">{t('configurations.editor.archUniversal')}</option>
              <option value="armeabi">{t('configurations.editor.archArmeabi')}</option>
              <option value="arm64">{t('configurations.editor.archArm64')}</option>
            </select>
            {warning && <p className="text-sm text-amber-700 dark:text-amber-300">{warning}</p>}
            {successHint && <p className="text-sm text-green-700 dark:text-green-300">{successHint}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(application.system)}
                onChange={(e) =>
                  setApplication((prev) => ({ ...prev, system: e.target.checked }))
                }
              />
              {t('configurations.editor.fields.preinstalledApp')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(application.showIcon)}
                onChange={(e) =>
                  setApplication((prev) => ({ ...prev, showIcon: e.target.checked }))
                }
              />
              {t('configurations.editor.showIcon')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(application.runAfterInstall)}
                disabled={Boolean(application.system)}
                onChange={(e) =>
                  setApplication((prev) => ({ ...prev, runAfterInstall: e.target.checked }))
                }
              />
              {t('configurations.editor.fields.runAfterInstall')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(application.runAtBoot)}
                disabled={Boolean(application.system)}
                onChange={(e) =>
                  setApplication((prev) => ({ ...prev, runAtBoot: e.target.checked }))
                }
              />
              {t('configurations.editor.fields.runAtBoot')}
            </label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-url">{t('configurations.editor.fields.appUrl')}</Label>
            <Input
              id="app-url"
              value={application.url ?? ''}
              onChange={(e) => setApplication((prev) => ({ ...prev, url: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">{t('configurations.editor.appUrlHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-file">{t('configurations.editor.fields.apkFile')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                ref={fileInputRef}
                id="app-file"
                type="file"
                accept=".apk,.xapk"
                onChange={(e) => void handleFileChange(e)}
              />
              {fileName && (
                <>
                  <span className="text-sm text-muted-foreground">{fileName}</span>
                  <Button type="button" variant="outline" size="sm" onClick={clearFile}>
                    {t('common.clear')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
