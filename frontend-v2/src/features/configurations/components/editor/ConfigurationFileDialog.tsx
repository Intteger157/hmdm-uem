import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigurationFileEntry } from '@/features/configurations/types/configuration'
import {
  fetchFiles,
  updateFile,
  uploadRawFile,
  type FileEntry,
} from '@/features/files/api/files-api'
import { useFileStorageLimitQuery } from '@/features/files/hooks/use-files'
import { BoolField } from '@/shared/components/BoolField'
import { FormSelect } from '@/shared/components/FormSelect'
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

const CREATE_NEW_ID = 0

interface ConfigurationFileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  configFile: ConfigurationFileEntry | null
  existingFiles: ConfigurationFileEntry[]
  defaultFilePath?: string
  onSave: (file: ConfigurationFileEntry) => void
}

function serverFileLabel(file: FileEntry): string {
  return file.description || (file.external ? file.url : file.filePath) || `#${file.id}`
}

export function ConfigurationFileDialog({
  open,
  onOpenChange,
  configFile,
  existingFiles,
  defaultFilePath = '/Download/',
  onSave,
}: ConfigurationFileDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: limitData } = useFileStorageLimitQuery(open)

  const [serverFiles, setServerFiles] = useState<FileEntry[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number>(CREATE_NEW_ID)
  const [uploadDraft, setUploadDraft] = useState<FileEntry>({ external: false, replaceVariables: false })
  const [devicePath, setDevicePath] = useState('')
  const [overridePath, setOverridePath] = useState(false)
  const [removeFromDevice, setRemoveFromDevice] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const usedFileIds = useMemo(
    () => new Set(existingFiles.map((f) => f.fileId).filter((id): id is number => id != null)),
    [existingFiles]
  )

  const availableSpaceHint = useMemo(() => {
    if (!limitData?.sizeLimit || limitData.sizeLimit <= 0) {
      return undefined
    }
    const available = Math.max(0, limitData.sizeLimit - (limitData.sizeUsed ?? 0))
    if (available >= 20) {
      return undefined
    }
    return t('files.form.availableSpace', { space: available })
  }, [limitData, t])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    void fetchFiles().then((files) => {
      if (cancelled) {
        return
      }

      const filtered = files.filter(
        (file) =>
          file.id != null &&
          (!usedFileIds.has(file.id) || configFile?.fileId === file.id)
      )
      setServerFiles(filtered)

      if (configFile?.fileId) {
        setSelectedFileId(configFile.fileId)
        setDevicePath(configFile.path ?? '')
        setOverridePath(configFile.overridePath === true)
        setRemoveFromDevice(configFile.remove === true)
      } else if (filtered.length > 0) {
        setSelectedFileId(filtered[0].id ?? CREATE_NEW_ID)
        setDevicePath(filtered[0].devicePath ?? '')
      } else {
        setSelectedFileId(CREATE_NEW_ID)
        setDevicePath('')
      }

      setUploadDraft({ external: false, replaceVariables: false })
      setUploadProgress(null)
      setError(undefined)
    })

    return () => {
      cancelled = true
    }
  }, [open, configFile, usedFileIds])

  const isCreateNew = selectedFileId === CREATE_NEW_ID

  const handleFileSelectChange = (value: string) => {
    const id = Number(value)
    setSelectedFileId(id)
    setError(undefined)

    if (id === CREATE_NEW_ID) {
      setDevicePath('')
      return
    }

    const selected = serverFiles.find((file) => file.id === id)
    setDevicePath(selected?.devicePath ?? '')
  }

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) {
      return
    }

    setLoading(true)
    setUploadProgress(0)
    setError(undefined)

    try {
      const result = await uploadRawFile(file, (loaded, total) => {
        setUploadProgress(Math.round((loaded / total) * 100))
      })
      const basePath = defaultFilePath.endsWith('/') ? defaultFilePath : `${defaultFilePath}/`
      setUploadDraft((prev) => ({
        ...prev,
        filePath: result.name,
        tmpPath: result.serverPath,
      }))
      setDevicePath(`${basePath}${result.name ?? file.name}`)
    } catch {
      setError(t('files.form.uploadError'))
    } finally {
      setLoading(false)
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    setError(undefined)

    if (isCreateNew) {
      if (uploadDraft.external) {
        if (!uploadDraft.externalUrl?.trim()) {
          setError(t('configurations.editor.files.errorEmptyUrl'))
          return
        }
      } else if (!uploadDraft.tmpPath) {
        setError(t('configurations.editor.files.errorEmptyFile'))
        return
      }

      setLoading(true)
      try {
        const created = await updateFile({
          ...uploadDraft,
          devicePath,
          id: undefined,
        })

        onSave({
          fileId: created.id,
          description: created.description,
          path: devicePath || created.devicePath,
          url: created.url,
          filePath: created.filePath,
          overridePath: false,
          remove: false,
          replaceVariables: created.replaceVariables,
          tempId: Date.now(),
        })
        onOpenChange(false)
      } catch {
        setError(t('files.form.saveError'))
      } finally {
        setLoading(false)
      }
      return
    }

    const selected = serverFiles.find((file) => file.id === selectedFileId)
    if (!selected?.id) {
      setError(t('configurations.editor.files.errorSelectFile'))
      return
    }

    onSave({
      id: configFile?.id,
      tempId: configFile?.tempId ?? Date.now(),
      fileId: selected.id,
      description: selected.description,
      path: devicePath || selected.devicePath,
      url: selected.url,
      filePath: selected.filePath,
      overridePath,
      remove: removeFromDevice,
      replaceVariables: selected.replaceVariables,
      external: selected.external,
    })
    onOpenChange(false)
  }

  const selectOptions = useMemo(
    () => [
      { value: CREATE_NEW_ID, label: t('configurations.editor.files.createNew') },
      ...serverFiles.map((file) => ({
        value: file.id ?? 0,
        label: serverFileLabel(file),
      })),
    ],
    [serverFiles, t]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {configFile
              ? t('configurations.editor.files.editTitle')
              : t('configurations.editor.files.addTitle')}
          </DialogTitle>
          <DialogDescription>{t('configurations.editor.files.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormSelect
            id="config-file-select"
            label={t('configurations.editor.files.selectFile')}
            value={selectedFileId}
            onChange={handleFileSelectChange}
            options={selectOptions}
          />

          {isCreateNew ? (
            <>
              <BoolField
                id="file-external"
                label={t('files.form.external')}
                checked={uploadDraft.external === true}
                onCheckedChange={(checked) =>
                  setUploadDraft((prev) => ({ ...prev, external: checked }))
                }
              />

              {!uploadDraft.external && (
                <div className="space-y-2">
                  <Label>{t('files.form.file')}</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    disabled={loading}
                    onChange={(e) => void handleUpload(e.target.files)}
                  />
                  {availableSpaceHint ? (
                    <p className="text-xs text-muted-foreground">{availableSpaceHint}</p>
                  ) : null}
                  {uploadProgress != null && (
                    <Progress value={uploadProgress}>
                      <ProgressTrack>
                        <ProgressIndicator />
                      </ProgressTrack>
                      <ProgressValue />
                    </Progress>
                  )}
                </div>
              )}

              {!uploadDraft.external && (
                <div className="space-y-2">
                  <Label htmlFor="file-path">{t('files.form.path')}</Label>
                  <Input
                    id="file-path"
                    value={uploadDraft.filePath ?? ''}
                    onChange={(e) =>
                      setUploadDraft((prev) => ({ ...prev, filePath: e.target.value }))
                    }
                  />
                </div>
              )}

              {uploadDraft.external && (
                <div className="space-y-2">
                  <Label htmlFor="external-url">{t('files.form.externalUrl')}</Label>
                  <Input
                    id="external-url"
                    value={uploadDraft.externalUrl ?? ''}
                    onChange={(e) =>
                      setUploadDraft((prev) => ({ ...prev, externalUrl: e.target.value }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="file-description">{t('files.form.description')}</Label>
                <Input
                  id="file-description"
                  value={uploadDraft.description ?? ''}
                  onChange={(e) =>
                    setUploadDraft((prev) => ({ ...prev, description: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-device-path">{t('configurations.editor.fileDevicePath')}</Label>
                <Input
                  id="create-device-path"
                  value={devicePath}
                  onChange={(e) => setDevicePath(e.target.value)}
                />
              </div>

              <BoolField
                id="replace-variables"
                label={t('files.form.replaceVariables')}
                hint={t('files.form.replaceVariablesHint')}
                checked={uploadDraft.replaceVariables === true}
                onCheckedChange={(checked) =>
                  setUploadDraft((prev) => ({ ...prev, replaceVariables: checked }))
                }
              />
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="device-path">{t('configurations.editor.fileDevicePath')}</Label>
                <Input
                  id="device-path"
                  value={devicePath}
                  disabled={Boolean(configFile?.fileId && !overridePath)}
                  onChange={(e) => setDevicePath(e.target.value)}
                />
              </div>

              {configFile?.fileId != null && (
                <BoolField
                  id="override-path"
                  label={t('configurations.editor.files.overridePath')}
                  checked={overridePath}
                  onCheckedChange={setOverridePath}
                />
              )}

              <BoolField
                id="file-remove"
                label={t('configurations.editor.files.removeFromDevice')}
                checked={removeFromDevice}
                onCheckedChange={setRemoveFromDevice}
              />
            </>
          )}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled={loading} onClick={() => void handleSave()}>
            {loading ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
