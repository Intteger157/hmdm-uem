import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Loader2, Plus, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { formatUploadBytes } from '@/features/windows/applications/utils/installer-upload'
import {
  useDeleteStoredFileMutation,
  useStoredFilesQuery,
} from '@/features/windows/files/hooks/use-windows-files'
import {
  selectIsGlobalUploading,
  useGlobalUploadStore,
} from '@/features/upload/store/global-upload-store'
import type { StoredFile } from '@/features/windows/files/types/stored-file'
import {
  WINDOWS_GRID_FILES,
  WindowsDataList,
  WindowsDataListBody,
  WindowsDataListCell,
  WindowsDataListHeader,
  WindowsDataListPanel,
  WindowsDataListRow,
} from '@/features/windows/components/WindowsDataList'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { getWindowsApiErrorMessage } from '@/features/windows/applications/utils/app-catalog-errors'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { PageContainer, PageHeader } from '@/shared/layout/page-layout'
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
  const { canMutate } = usePermissions()
  const { data, isLoading, error, refetch } = useStoredFilesQuery()
  const deleteMutation = useDeleteStoredFileMutation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const startStoredFileUpload = useGlobalUploadStore((state) => state.startStoredFileUpload)
  const isUploading = useGlobalUploadStore(selectIsGlobalUploading)
  const [deleteTarget, setDeleteTarget] = useState<StoredFile | null>(null)
  const [isForceDeleteRequired, setIsForceDeleteRequired] = useState(false)

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
    <PageContainer size="wide">
      <PageHeader title={t('windowsFiles.title')} description={t('windowsFiles.description')}>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                startStoredFileUpload(file)
                resetFileInput()
              }
            }}
          />
          {canMutate && (
            <Button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              {t('windowsFiles.upload.button')}
            </Button>
          )}
        </div>
      </PageHeader>

      {isLoading ? (
        <WindowsDataListPanel className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('common.loading')}
        </WindowsDataListPanel>
      ) : error ? (
        <WindowsDataListPanel className="space-y-3 py-12 text-center">
          <p className="text-sm text-destructive">{t('windowsFiles.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </WindowsDataListPanel>
      ) : !data?.length ? (
        <WindowsDataListPanel className="flex flex-col items-center gap-3 py-16 text-center">
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('windowsFiles.empty')}</p>
        </WindowsDataListPanel>
      ) : (
        <WindowsDataList aria-label={t('windowsFiles.title')}>
          <WindowsDataListHeader gridClass={WINDOWS_GRID_FILES}>
            <WindowsDataListCell role="columnheader">{t('windowsFiles.columns.name')}</WindowsDataListCell>
            <WindowsDataListCell role="columnheader">{t('windowsFiles.columns.size')}</WindowsDataListCell>
            <WindowsDataListCell role="columnheader">{t('windowsFiles.columns.uploaded')}</WindowsDataListCell>
            <WindowsDataListCell role="columnheader">{t('windowsFiles.columns.sha256')}</WindowsDataListCell>
            {canMutate ? (
              <WindowsDataListCell role="columnheader" className="text-right" aria-hidden>
                {'\u00a0'}
              </WindowsDataListCell>
            ) : null}
          </WindowsDataListHeader>

          <WindowsDataListBody>
            {data.map((file) => (
              <WindowsDataListRow key={file.id} gridClass={WINDOWS_GRID_FILES}>
                <WindowsDataListCell>
                  <div className="truncate font-medium">{file.originalName}</div>
                </WindowsDataListCell>
                <WindowsDataListCell className="tabular-nums text-muted-foreground">
                  {formatUploadBytes(file.sizeBytes)}
                </WindowsDataListCell>
                <WindowsDataListCell className="whitespace-nowrap text-muted-foreground">
                  {formatTimestamp(file.uploadDate)}
                </WindowsDataListCell>
                <WindowsDataListCell>
                  <span className="font-mono text-xs text-muted-foreground">{file.sha256.slice(0, 12)}…</span>
                </WindowsDataListCell>
                {canMutate ? (
                  <WindowsDataListCell className="flex justify-end">
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
                  </WindowsDataListCell>
                ) : null}
              </WindowsDataListRow>
            ))}
          </WindowsDataListBody>
        </WindowsDataList>
      )}

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
    </PageContainer>
  )
}
