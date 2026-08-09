import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { copyTextToClipboard } from '@/shared/lib/copy-to-clipboard'
import { cn } from '@/lib/utils'

interface OverviewCopyButtonProps {
  value: string
  className?: string
}

export function OverviewCopyButton({ value, className }: OverviewCopyButtonProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    void (async () => {
      try {
        await copyTextToClipboard(value)
        setCopied(true)
        toast.success(t('deviceDetail.overview.copied'))
        window.setTimeout(() => setCopied(false), 1500)
      } catch {
        toast.error(t('deviceDetail.overview.copyFailed'))
      }
    })()
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('size-7 text-muted-foreground hover:text-foreground', className)}
      title={t('deviceDetail.overview.copy')}
      onClick={handleCopy}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </Button>
  )
}
