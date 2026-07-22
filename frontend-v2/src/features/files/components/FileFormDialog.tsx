import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  fileDisplayName,
  uploadRawFile,
  type FileEntry,
} from '@/features/files/api/files-api'
import { useFileStorageLimitQuery, useUpdateFileMutation } from '@/features/files/hooks/use-files'
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
import { Label } from '@/components/ui/label'
import { Progress, ProgressIndicator, ProgressTrack, ProgressValue } from '@/components/ui/progress'
import { toast } from 'sonner'

interface FileFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file?: FileEntry | null
  onSaved?: (file: FileEntry) => void
}

export function FileFormDialog({ open, onOpenChange, file, onSaved }: FileFormDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const updateMutation = useUpdateFileMutation()
  const { data: limitData } = useFileStorageLimitQuery(open)

  const [draft, setDraft] = useState<FileEntry>({})
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | undefined>()

  const isEdit = file?.id != null

  useEffect(() => {
    if (!open) {
      return
    }
    if (file) {
      setDraft({
        ...file,
        externalUrl: file.external ? file.url : file.externalUrl,
      })
    } else {
      setDraft({ external: false, replaceVariables: false, devicePath: '/Download/' })
    }
    setUploadProgress(null)
    setError(undefined)
  }, [open, file])

  const availableSpaceHint =
    limitData?.sizeLimit && limitData.sizeLimit > 0
      ? (() => {
          const available = Math.max(0, limitData.sizeLimit! - (limitData.sizeUsed ?? 0))
          return available < 20
            ? t('files.form.availableSpace', { space: available })
            : undefined
        })()
      : undefined

  const handleUpload = async (fileList: FileList | null) => {
    const selected = fileList?.[0]
    if (!selected) {
      return
    }

    setUploadProgress(0)
    setError(undefined)

    try {
      const result = await uploadRawFile(selected, (loaded, total) => {
        setUploadProgress(Math.round((loaded / total) * 100))
      })
      setDraft((prev) => ({
        ...prev,
        filePath: result.name,
        tmpPath: result.serverPath,
        devicePath: prev.devicePath || `/Download/${result.name ?? selected.name}`,
      }))
    } catch {
      setError(t('files.form.uploadError'))
    } finally {
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    setError(undefined)

    if (!isEdit && !draft.external && !draft.tmpPath) {
      setError(t('files.form.errorEmpty'))
      return
    }

    if (draft.external && !draft.externalUrl?.trim()) {
      setError(t('files.form.errorExternalUrl'))
      return
    }

    try {
      const saved = await updateMutation.mutateAsync({
        ...draft,
        externalUrl: draft.external ? draft.externalUrl : undefined,
      })
      toast.success(t('files.form.saved'))
      onSaved?.(saved)
      onOpenChange(false)
    } catch {
      setError(t('files.form.saveError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('files.form.editTitle') : t('files.form.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('files.form.editDescription', { name: fileDisplayName(file ?? {}) })
              : t('files.form.addDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-description">{t('files.form.description')}</Label>
            <Input
              id="file-description"
              value={draft.description ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {!isEdit && (
            <BoolField
              id="file-external"
              label={t('files.form.external')}
              checked={draft.external === true}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, external: checked }))}
            />
          )}

          {!isEdit && !draft.external && (
            <div className="space-y-2">
              <Label>{t('files.form.file')}</Label>
              <Input
                ref={fileInputRef}
                type="file"
                disabled={updateMutation.isPending}
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

          {!draft.external && (
            <div className="space-y-2">
              <Label htmlFor="file-path">{t('files.form.path')}</Label>
              <Input
                id="file-path"
                value={draft.filePath ?? ''}
                disabled={isEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, filePath: e.target.value }))}
              />
            </div>
          )}

          {draft.external && (
            <div className="space-y-2">
              <Label htmlFor="external-url">{t('files.form.externalUrl')}</Label>
              <Input
                id="external-url"
                value={draft.externalUrl ?? ''}
                disabled={isEdit}
                onChange={(e) => setDraft((prev) => ({ ...prev, externalUrl: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="device-path">{t('files.form.devicePath')}</Label>
            <Input
              id="device-path"
              value={draft.devicePath ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, devicePath: e.target.value }))}
            />
          </div>

          <BoolField
            id="replace-variables"
            label={t('files.form.replaceVariables')}
            hint={t('files.form.replaceVariablesHint')}
            checked={draft.replaceVariables === true}
            disabled={isEdit}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, replaceVariables: checked }))
            }
          />

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={updateMutation.isPending}
            onClick={() => void handleSave()}
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
