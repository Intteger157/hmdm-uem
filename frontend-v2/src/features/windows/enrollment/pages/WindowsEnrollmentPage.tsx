import { Copy } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

function buildBootstrapCommand(origin: string): string {
  const enrollUrl = `${origin.replace(/\/+$/, '')}/api/windows/enroll`
  return `Invoke-RestMethod -Uri "${enrollUrl}" | Invoke-Expression`
}

export function WindowsEnrollmentPage() {
  const { t } = useTranslation()
  const bootstrapCommand = useMemo(
    () => buildBootstrapCommand(typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  )

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(bootstrapCommand)
      toast.success(t('windows.enrollmentPage.copySuccess'))
    } catch {
      toast.error(t('windows.enrollment.copyFailed'))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('windows.enrollmentPage.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('windows.enrollmentPage.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('windows.enrollmentPage.cardTitle')}</CardTitle>
          <CardDescription>{t('windows.enrollmentPage.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative rounded-lg border bg-muted/40">
            <pre className="overflow-x-auto p-4 pr-28 text-xs leading-relaxed sm:text-sm">
              <code>{bootstrapCommand}</code>
            </pre>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute right-3 top-3 gap-1.5"
              onClick={() => void handleCopy()}
            >
              <Copy className="size-4" />
              {t('windows.enrollmentPage.copyCommand')}
            </Button>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
            {t('windows.enrollmentPage.instructions')}
          </div>

          <p className="text-xs text-muted-foreground">{t('windows.enrollmentPage.agentBinaryHint')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
