import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Copy, Loader2, Upload } from 'lucide-react'
import {
  DEFAULT_AGENT_MSI_NAME,
  DEFAULT_AGENT_MSI_PATH,
  createWindowsEnrollmentToken,
  filesRelativePathFromUrl,
  registerDefaultWindowsInstaller,
} from '@/features/windows/api/windows-api'
import { uploadRawFile, updateFile } from '@/features/files/api/files-api'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface WindowsEnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildMsiCommand(serverUrl: string): string {
  return `.\\agent-windows\\installer\\build-msi.ps1 -ServerUrl "${serverUrl}"`
}

export function WindowsEnrollmentDialog({ open, onOpenChange }: WindowsEnrollmentDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [enrollScript, setEnrollScript] = useState<string | null>(null)
  const [installerConfigured, setInstallerConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [permanentFileUrl, setPermanentFileUrl] = useState<string | null>(null)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const msiBuildCommand = useMemo(() => {
    if (!serverUrl) {
      return ''
    }
    return buildMsiCommand(serverUrl)
  }, [serverUrl])

  useEffect(() => {
    if (!open) {
      setEnrollScript(null)
      setInstallerConfigured(false)
      setError(null)
      setIsLoading(false)
      setIsUploading(false)
      setUploadError(null)
      setDownloadUrl(null)
      setPermanentFileUrl(null)
      return
    }

    let cancelled = false

    const loadEnrollment = async () => {
      setIsLoading(true)
      setError(null)
      setEnrollScript(null)
      setPermanentFileUrl(null)
      setUploadError(null)

      try {
        const response = await createWindowsEnrollmentToken()
        if (cancelled) {
          return
        }

        setInstallerConfigured(response.installerConfigured === true)
        setDownloadUrl(response.downloadUrl ?? null)
        setPermanentFileUrl(response.permanentFileUrl ?? null)
        setEnrollScript(response.enrollScript ?? null)
      } catch {
        if (!cancelled) {
          setError(t('windows.enrollment.loadError'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadEnrollment()

    return () => {
      cancelled = true
    }
  }, [open, t])

  const copyText = async (text: string, successKey: string, failKey: string) => {
    if (!text) {
      return
    }

    try {
      await copyTextToClipboard(text)
      toast.success(t(successKey))
    } catch {
      toast.error(t(failKey))
    }
  }

  const handleRegisterInstaller = async (file: File) => {
    setIsUploading(true)
    setUploadError(null)

    try {
      const raw = await uploadRawFile(file)
      if (!raw.serverPath) {
        throw new Error('missing server path')
      }

      const saved = await updateFile({
        tmpPath: raw.serverPath,
        filePath: DEFAULT_AGENT_MSI_PATH,
        description: t('windows.enrollment.universalInstallerDescription'),
      })

      if (!saved.url) {
        throw new Error('missing file url')
      }

      await registerDefaultWindowsInstaller({
        filesRelativePath: filesRelativePathFromUrl(saved.url),
        fileName: DEFAULT_AGENT_MSI_NAME,
        permanentFileUrl: saved.url,
      })

      setInstallerConfigured(true)
      toast.success(t('windows.enrollment.registerInstallerSuccess'))

      const refreshed = await createWindowsEnrollmentToken()
      setDownloadUrl(refreshed.downloadUrl ?? null)
      setPermanentFileUrl(refreshed.permanentFileUrl ?? null)
      setEnrollScript(refreshed.enrollScript ?? null)
    } catch {
      setUploadError(t('windows.enrollment.registerInstallerError'))
    } finally {
      setIsUploading(false)
    }
  }

  const renderCodeBlock = (
    text: string,
    copyLabel: string,
    successKey: string,
    failKey: string,
  ) => (
    <div className="relative rounded-lg border bg-muted/40">
      <pre className="overflow-x-auto p-4 pr-24 text-xs leading-relaxed sm:text-sm">
        <code>{text}</code>
      </pre>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-3 top-3"
        onClick={() => void copyText(text, successKey, failKey)}
      >
        <Copy className="size-4" />
        {copyLabel}
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('windows.enrollment.title')}</DialogTitle>
          <DialogDescription>{t('windows.enrollment.descriptionUniversal')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('windows.enrollment.loading')}
          </div>
        ) : error ? (
          <div
            className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm"
            role="alert"
          >
            <AlertCircle className="size-5 shrink-0 text-destructive" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {!installerConfigured && (
              <section className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="text-sm font-medium">{t('windows.enrollment.setupTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('windows.enrollment.setupHint')}</p>
                {renderCodeBlock(
                  msiBuildCommand,
                  t('windows.enrollment.copy'),
                  'windows.enrollment.copied',
                  'windows.enrollment.copyFailed',
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".msi"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        void handleRegisterInstaller(file)
                      }
                      event.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {isUploading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )}
                    {isUploading
                      ? t('windows.enrollment.uploading')
                      : t('windows.enrollment.registerInstallerButton')}
                  </Button>
                </div>
                {uploadError && (
                  <p className="text-sm text-destructive" role="alert">
                    {uploadError}
                  </p>
                )}
              </section>
            )}

            {installerConfigured && downloadUrl && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">{t('windows.enrollment.downloadLinkTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('windows.enrollment.downloadLinkHintUniversal')}
                </p>
                {renderCodeBlock(
                  downloadUrl,
                  t('windows.enrollment.copyLink'),
                  'windows.enrollment.linkCopied',
                  'windows.enrollment.copyFailed',
                )}
              </section>
            )}

            {installerConfigured && enrollScript && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">{t('windows.enrollment.enrollScriptTitle')}</h3>
                <p className="text-sm text-muted-foreground">{t('windows.enrollment.enrollScriptHint')}</p>
                {renderCodeBlock(
                  enrollScript,
                  t('windows.enrollment.copy'),
                  'windows.enrollment.copied',
                  'windows.enrollment.copyFailed',
                )}
              </section>
            )}

            {permanentFileUrl && (
              <p className="text-xs text-muted-foreground">
                {t('windows.enrollment.permanentFileHint')}{' '}
                <a
                  href={permanentFileUrl}
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {permanentFileUrl}
                </a>
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
