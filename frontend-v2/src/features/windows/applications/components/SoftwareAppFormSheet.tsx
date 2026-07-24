import { Loader2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { uploadSoftwareApp } from '@/features/windows/applications/api/windows-applications-api'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { windowsSoftwareAppQueryKeys } from '@/features/windows/applications/hooks/use-windows-software-apps'

interface SoftwareAppFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (appId: number) => void
}

function isSupportedInstaller(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.exe') || name.endsWith('.msi')
}

export function SoftwareAppFormSheet({ open, onOpenChange, onCreated }: SoftwareAppFormSheetProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleUploadFile = async (file: File) => {
    if (!isSupportedInstaller(file)) {
      toast.error(t('windowsAppCatalog.form.uploadInvalidType'))
      return
    }

    setUploading(true)
    try {
      const result = await uploadSoftwareApp(file)
      await queryClient.invalidateQueries({ queryKey: windowsSoftwareAppQueryKeys.all })
      toast.success(
        result.isNewApp ? t('windowsAppCatalog.form.created') : t('windowsAppCatalog.form.versionUploaded'),
      )
      onOpenChange(false)
      onCreated?.(result.appId)
    } catch {
      toast.error(t('windowsAppCatalog.form.uploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{t('windowsAppCatalog.form.createTitle')}</SheetTitle>
          <SheetDescription>{t('windowsAppCatalog.form.createDescription')}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
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
              'flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
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
        </div>
      </SheetContent>
    </Sheet>
  )
}
