import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Copy, Loader2 } from 'lucide-react'
import { createWindowsEnrollmentToken } from '@/features/windows/api/windows-api'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface WindowsEnrollmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function buildEnrollmentCommand(serverUrl: string, token: string): string {
  return `.\\mdm-agent.exe --server "${serverUrl}" --token "${token}"`
}

export function WindowsEnrollmentDialog({ open, onOpenChange }: WindowsEnrollmentDialogProps) {
  const { t } = useTranslation()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const command = useMemo(() => {
    if (!token || !serverUrl) {
      return ''
    }
    return buildEnrollmentCommand(serverUrl, token)
  }, [serverUrl, token])

  useEffect(() => {
    if (!open) {
      setToken(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false

    const loadToken = async () => {
      setIsLoading(true)
      setError(null)
      setToken(null)

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

  const handleCopy = async () => {
    if (!command) {
      return
    }

    try {
      await copyTextToClipboard(command)
      toast.success(t('windows.enrollment.copied'))
    } catch {
      toast.error(t('windows.enrollment.copyFailed'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('windows.enrollment.instructions')}</p>
            <div className="relative rounded-lg border bg-muted/40">
              <pre className="overflow-x-auto p-4 pr-24 text-xs leading-relaxed sm:text-sm">
                <code>{command}</code>
              </pre>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-3 top-3"
                onClick={() => void handleCopy()}
              >
                <Copy className="size-4" />
                {t('windows.enrollment.copy')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
