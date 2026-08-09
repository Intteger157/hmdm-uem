import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { useGlobalUploadGuard } from '@/features/upload/hooks/use-global-upload-guard'
import { useGlobalUploadStore } from '@/features/upload/store/global-upload-store'
import { buildUploadProgressLabel } from '@/features/windows/applications/utils/installer-upload'
import { windowsFilesQueryKeys } from '@/features/windows/files/hooks/use-windows-files'
import { cn } from '@/lib/utils'

export function GlobalUploadManager() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const upload = useGlobalUploadStore((state) => state.upload)
  const cancelUpload = useGlobalUploadStore((state) => state.cancelUpload)
  const dismiss = useGlobalUploadStore((state) => state.dismiss)
  const previousStatusRef = useRef(upload?.status)

  useGlobalUploadGuard()

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    const currentStatus = upload?.status

    if (currentStatus === previousStatus) {
      return
    }

    previousStatusRef.current = currentStatus

    if (currentStatus === 'success') {
      void queryClient.invalidateQueries({ queryKey: windowsFilesQueryKeys.list() })
    } else if (currentStatus === 'error') {
      toast.error(t('windowsFiles.upload.error'))
    }
  }, [upload?.status, queryClient, t])

  if (!upload) {
    return null
  }

  const isUploading = upload.status === 'uploading'
  const isSuccess = upload.status === 'success'
  const isError = upload.status === 'error'

  return (
    <div
      className={cn(
        'pointer-events-auto fixed right-4 bottom-4 z-50 w-[min(100vw-2rem,22rem)]',
        'transform transition-all duration-300 ease-out',
        'translate-y-0 opacity-100',
      )}
      role="status"
      aria-live="polite"
      aria-label={t('uploadManager.ariaLabel')}
    >
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111] shadow-2xl shadow-black/40">
        <div className="flex items-start gap-3 p-4">
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10',
              isSuccess && 'bg-emerald-500/10 text-emerald-400',
              isError && 'bg-destructive/10 text-destructive',
              isUploading && 'bg-blue-500/10 text-blue-400',
            )}
          >
            {isSuccess ? (
              <CheckCircle2 className="size-4" aria-hidden />
            ) : isUploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{upload.fileName}</p>
                <p className="text-xs text-white/50">
                  {isSuccess
                    ? t('uploadManager.success')
                    : isError
                      ? t('windowsFiles.upload.error')
                      : t('uploadManager.uploading')}
                </p>
              </div>

              {(isUploading || isError) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label={
                    isUploading ? t('uploadManager.cancel') : t('common.close')
                  }
                  onClick={() => {
                    if (isUploading) {
                      cancelUpload()
                    } else {
                      dismiss()
                    }
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {isUploading ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                  <span className="text-white/70">{buildUploadProgressLabel(upload.progress)}</span>
                  <span className="font-medium text-white">{upload.progress.percent}%</span>
                </div>
                <Progress value={upload.progress.percent} className="gap-0">
                  <ProgressTrack className="h-1.5 bg-white/10">
                    <ProgressIndicator className="bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-300 ease-out" />
                  </ProgressTrack>
                </Progress>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={cancelUpload}
                >
                  {t('uploadManager.cancel')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
