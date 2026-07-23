import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Copy, Loader2 } from 'lucide-react'
import { getWindowsEnrollmentSetup } from '@/features/windows/api/windows-api'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface WindowsEnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WindowsEnrollmentDialog({ open, onOpenChange }: WindowsEnrollmentDialogProps) {
  const { t } = useTranslation()

  const [orgSecret, setOrgSecret] = useState<string | null>(null)
  const [buildCommand, setBuildCommand] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const fallbackBuildCommand = useMemo(() => {
    if (!orgSecret || !serverUrl) {
      return ''
    }
    return `.\\agent-windows\\installer\\build-msi.ps1 -ServerUrl "${serverUrl}" -Token "${orgSecret}"`
  }, [orgSecret, serverUrl])

  const msiBuildCommand = buildCommand || fallbackBuildCommand

  useEffect(() => {
    if (!open) {
      setOrgSecret(null)
      setBuildCommand(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadSetup = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await getWindowsEnrollmentSetup()
        if (cancelled) {
          return
        }

        setOrgSecret(response.orgEnrollmentSecret)
        setBuildCommand(response.buildCommand ?? null)
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

    void loadSetup()

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

  const renderCodeBlock = (
    text: string,
    copyLabel: string,
    successKey: string,
    failKey: string,
  ) => (
    <div className="relative rounded-lg border bg-muted/40">
      <pre className="overflow-x-auto p-4 pr-16 text-xs leading-relaxed sm:text-sm">
        <code>{text}</code>
      </pre>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute right-3 top-3 gap-1.5 px-2.5"
        onClick={() => void copyText(text, successKey, failKey)}
      >
        <Copy className="size-4" />
        {copyLabel}
      </Button>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('windows.enrollment.title')}</DialogTitle>
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
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('windows.enrollment.secretTitle')}</h3>
              {orgSecret &&
                renderCodeBlock(
                  orgSecret,
                  t('windows.enrollment.copy'),
                  'windows.enrollment.secretCopied',
                  'windows.enrollment.copyFailed',
                )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-medium">{t('windows.enrollment.buildCommandTitle')}</h3>
              {renderCodeBlock(
                msiBuildCommand,
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
