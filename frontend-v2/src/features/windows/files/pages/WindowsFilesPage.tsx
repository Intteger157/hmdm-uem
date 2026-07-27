import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Loader2, Plus, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { AppUploadProgress } from '@/features/windows/applications/components/AppUploadProgress'
import type { UploadProgressState } from '@/features/windows/applications/utils/installer-upload'
import { formatUploadBytes } from '@/features/windows/applications/utils/installer-upload'
import {
  useDeleteStoredFileMutation,
  useStoredFilesQuery,
  useUploadStoredFileMutation,
} from '@/features/windows/files/hooks/use-windows-files'
import type { StoredFile } from '@/features/windows/files/types/stored-file'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { getWindowsApiErrorMessage } from '@/features/windows/applications/utils/app-catalog-errors'
import { toast } from 'sonner'

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

export function WindowsFilesPage() {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useStoredFilesQuery()
  const uploadMutation = useUploadStoredFileMutation()
  const deleteMutation = useDeleteStoredFileMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StoredFile | null>(null)
  const [isForceDeleteRequired, setIsForceDeleteRequired] = useState(false)

  const resetDeleteDialog = () => {
    setDeleteTarget(null)
    setIsForceDeleteRequired(false)
  }

  const isStoredFileInUseError = (error: unknown): boolean => {
    if (!axios.isAxiosError(error)) {
      return false
    }
    if (error.response?.status === 409) {
      return true
    }
    const message = getWindowsApiErrorMessage(error, '')
    return /configuration deployments?/i.test(message)
  }

  const handleUpload = async (file: File) => {
    setUploadProgress({ percent: 0, loaded: 0, total: file.size })
    try {
      await uploadMutation.mutateAsync({
        file,
        onUploadProgress: setUploadProgress,
      })
      toast.success(t('windowsFiles.upload.success'))
    } catch (error) {
      toast.error(getWindowsApiErrorMessage(error, t('windowsFiles.upload.error')))
    } finally {
      setUploadProgress(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        force: isForceDeleteRequired,
      })
      toast.success(
        isForceDeleteRequired
          ? t('windowsFiles.delete.forceSuccess')
          : t('windowsFiles.delete.success'),
      )
      resetDeleteDialog()
    } catch (error: unknown) {
      if (!isForceDeleteRequired && isStoredFileInUseError(error)) {
        setIsForceDeleteRequired(true)
        return
      }
      toast.error(getWindowsApiErrorMessage(error, t('windowsFiles.delete.error')))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('windowsFiles.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('windowsFiles.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={uploadMutation.isPending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleUpload(file)
              }
            }}
          />
          <Button
            type="button"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t('windowsFiles.upload.button')}
          </Button>
        </div>
      </div>

      {uploadMutation.isPending && uploadProgress ? (
        <Card>
          <CardContent className="py-6">
            <AppUploadProgress progress={uploadProgress} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="space-y-3 py-12 text-center">
              <p className="text-sm text-destructive">{t('windowsFiles.loadError')}</p>
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : !data?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('windowsFiles.empty')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-4 py-3 font-medium">{t('windowsFiles.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsFiles.columns.size')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsFiles.columns.uploaded')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsFiles.columns.sha256')}</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {data.map((file) => (
                    <tr key={file.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{file.originalName}</td>
                      <td className="px-4 py-3 tabular-nums">{formatUploadBytes(file.sizeBytes)}</td>
                      <td className="px-4 py-3">{formatTimestamp(file.uploadDate)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{file.sha256.slice(0, 12)}…</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          aria-label={t('windowsFiles.delete.title')}
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            resetDeleteDialog()
          }
        }}
        title={t('windowsFiles.delete.title')}
        description={
          isForceDeleteRequired
            ? t('windowsFiles.delete.forceConfirm')
            : t('windowsFiles.delete.confirm', { name: deleteTarget?.originalName ?? '' })
        }
        descriptionClassName={isForceDeleteRequired ? 'text-destructive' : undefined}
        leadingIcon={
          isForceDeleteRequired ? <TriangleAlert className="size-4 text-destructive" /> : undefined
        }
        confirmLabel={
          isForceDeleteRequired ? t('windowsFiles.delete.forceButton') : undefined
        }
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
