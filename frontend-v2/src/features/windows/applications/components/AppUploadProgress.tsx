import { useTranslation } from 'react-i18next'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import {
  buildUploadProgressLabel,
  type UploadProgressState,
} from '@/features/windows/applications/utils/installer-upload'

interface AppUploadProgressProps {
  progress: UploadProgressState
}

export function AppUploadProgress({ progress }: AppUploadProgressProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t('windowsAppCatalog.form.uploading')}</p>
      <Progress value={progress.percent}>
        <ProgressLabel className="text-xs">{buildUploadProgressLabel(progress)}</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  )
}
