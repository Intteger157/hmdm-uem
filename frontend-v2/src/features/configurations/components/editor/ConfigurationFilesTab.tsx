import { useTranslation } from 'react-i18next'
import type { Configuration } from '@/features/configurations/types/configuration'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ConfigurationFilesTabProps {
  draft: Configuration
}

export function ConfigurationFilesTab({ draft }: ConfigurationFilesTabProps) {
  const { t } = useTranslation()
  const files = draft.files ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.filesTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.filesDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('configurations.editor.noFiles')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileDescription')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileDevicePath')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileUrl')}</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => (
                  <tr key={file.id ?? index} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{file.description ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{file.path ?? file.filePath ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                      {file.url ?? file.externalUrl ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t('configurations.editor.filesHint')}</p>
      </CardContent>
    </Card>
  )
}
