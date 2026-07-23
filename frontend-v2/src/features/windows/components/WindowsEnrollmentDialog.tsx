import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Copy, Loader2, Upload } from 'lucide-react'
import {
  createWindowsEnrollmentToken,
  filesRelativePathFromUrl,
  linkWindowsInstaller,
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

function buildEnrollmentCommand(serverUrl: string, token: string): string {
  return `.\\mdm-agent.exe --server "${serverUrl}" --token "${token}"`
}

function buildMsiCommand(serverUrl: string, token: string): string {
  return `.\\agent-windows\\installer\\build-msi.ps1 -ServerUrl "${serverUrl}" -Token "${token}"`
}

function installerFileName(token: string): string {
  const suffix = token.replace(/^win-enroll-/, '').slice(0, 12)
  return `HMDMAgent-${suffix}.msi`
}

export function WindowsEnrollmentDialog({ open, onOpenChange }: WindowsEnrollmentDialogProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [permanentFileUrl, setPermanentFileUrl] = useState<string | null>(null)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const command = useMemo(() => {
    if (!token || !serverUrl) {
      return ''
    }
    return buildEnrollmentCommand(serverUrl, token)
  }, [serverUrl, token])

  const msiBuildCommand = useMemo(() => {
    if (!token || !serverUrl) {
      return ''
    }
    return buildMsiCommand(serverUrl, token)
  }, [serverUrl, token])

  useEffect(() => {
    if (!open) {
      setToken(null)
      setError(null)
      setIsLoading(false)
      setIsUploading(false)
      setUploadError(null)
      setDownloadUrl(null)
      setPermanentFileUrl(null)
      return
    }

    let cancelled = false

    const loadToken = async () => {
      setIsLoading(true)
      setError(null)
      setToken(null)
      setDownloadUrl(null)
      setPermanentFileUrl(null)
      setUploadError(null)

      try {
        const response = await createWindowsEnrollmentToken()
        if (!cancelled) {
          setToken(response.token)
        }
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

    void loadToken()

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

  const handleUploadMsi = async (file: File) => {
    if (!token) {
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      const raw = await uploadRawFile(file)
      if (!raw.serverPath) {
        throw new Error('missing server path')
      }

      const filePath = `windows/agents/${installerFileName(token)}`
      const saved = await updateFile({
        tmpPath: raw.serverPath,
        filePath,
        description: t('windows.enrollment.installerDescription', { token }),
      })

      if (!saved.url) {
        throw new Error('missing file url')
      }

      const linked = await linkWindowsInstaller({
        enrollmentToken: token,
        filesRelativePath: filesRelativePathFromUrl(saved.url),
        fileName: installerFileName(token),
        permanentFileUrl: saved.url,
      })

      setDownloadUrl(linked.downloadUrl)
      setPermanentFileUrl(linked.permanentFileUrl)
      toast.success(t('windows.enrollment.uploadSuccess'))
    } catch {
      setUploadError(t('windows.enrollment.uploadError'))
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
          <DialogDescription>{t('windows.enrollment.description')}</DialogDescription>
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
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('windows.enrollment.msiBuildTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('windows.enrollment.msiBuildHint')}</p>
              {renderCodeBlock(
                msiBuildCommand,
                t('windows.enrollment.copy'),
                'windows.enrollment.copied',
                'windows.enrollment.copyFailed',
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('windows.enrollment.msiUploadTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('windows.enrollment.msiUploadHint')}</p>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".msi"
                  className="hidden"
                  disabled={isUploading || downloadUrl != null}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      void handleUploadMsi(file)
                    }
                    event.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isUploading || downloadUrl != null}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {isUploading
                    ? t('windows.enrollment.uploading')
                    : t('windows.enrollment.uploadButton')}
                </Button>
              </div>
              {uploadError && (
                <p className="text-sm text-destructive" role="alert">
                  {uploadError}
                </p>
              )}
            </section>

            {downloadUrl && (
              <section className="space-y-2">
                <h3 className="text-sm font-medium">{t('windows.enrollment.downloadLinkTitle')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('windows.enrollment.downloadLinkHint')}
                </p>
                {renderCodeBlock(
                  downloadUrl,
                  t('windows.enrollment.copyLink'),
                  'windows.enrollment.linkCopied',
                  'windows.enrollment.copyFailed',
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
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('windows.enrollment.manualTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('windows.enrollment.instructions')}</p>
              {renderCodeBlock(
                command,
                t('windows.enrollment.copy'),
                'windows.enrollment.copied',
                'windows.enrollment.copyFailed',
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
