import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { updateFile, uploadRawFile } from '@/features/files/api/files-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BackgroundImageUrlFieldProps {
  id?: string
  label: string
  value?: string
  disabled?: boolean
  onChange: (url: string | undefined) => void
}

export function BackgroundImageUrlField({
  id = 'bg-image',
  label,
  value = '',
  disabled = false,
  onChange,
}: BackgroundImageUrlFieldProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) {
      return
    }

    setUploading(true)

    try {
      const uploaded = await uploadRawFile(file)
      const fileName = uploaded.name ?? file.name
      const saved = await updateFile({
        external: false,
        replaceVariables: false,
        filePath: fileName,
        tmpPath: uploaded.serverPath,
        devicePath: `/Download/${fileName}`,
      })

      if (!saved.url) {
        throw new Error('missing url')
      }

      onChange(saved.url)
      toast.success(t('configurations.editor.backgroundImageUploaded'))
    } catch {
      toast.error(t('files.form.uploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={t('configurations.editor.backgroundImagePlaceholder')}
          className="min-w-0 flex-1"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp"
          className="hidden"
          disabled={disabled || uploading}
          onChange={(e) => void handleUpload(e.target.files)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || uploading}
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="mr-1 size-4" />
          )}
          {t('configurations.editor.uploadBackground')}
        </Button>
      </div>
    </div>
  )
}
