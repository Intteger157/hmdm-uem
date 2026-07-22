import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fileDisplayName, type FileConfigurationLink, type FileEntry } from '@/features/files/api/files-api'
import {
  useFileConfigurationsQuery,
  useUpdateFileConfigurationsMutation,
} from '@/features/files/hooks/use-files'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface FileConfigurationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  file: FileEntry | null
}

export function FileConfigurationsDialog({
  open,
  onOpenChange,
  file,
}: FileConfigurationsDialogProps) {
  const { t } = useTranslation()
  const { data, isLoading, error, refetch } = useFileConfigurationsQuery(file?.id, open)
  const updateMutation = useUpdateFileConfigurationsMutation()
  const [links, setLinks] = useState<FileConfigurationLink[]>([])

  useEffect(() => {
    if (data) {
      setLinks(data.map((link) => ({ ...link })))
    }
  }, [data])

  const handleSave = async () => {
    if (!file?.id) {
      return
    }

    try {
      await updateMutation.mutateAsync({
        fileId: file.id,
        configurations: links.map((link) => ({ ...link, notify: true })),
      })
      toast.success(t('files.configurations.saved'))
      onOpenChange(false)
    } catch {
      toast.error(t('files.configurations.error'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('files.configurations.title')}</DialogTitle>
          <DialogDescription>
            {t('files.configurations.description', { name: fileDisplayName(file ?? {}) })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : error ? (
          <div className="space-y-2 rounded-lg border border-destructive/40 p-4">
            <p className="text-sm text-destructive">{t('files.configurations.loadError')}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('files.configurations.empty')}</p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('files.configurations.configuration')}</th>
                  <th className="px-4 py-3 font-medium">{t('files.configurations.upload')}</th>
                  <th className="px-4 py-3 font-medium">{t('files.configurations.remove')}</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.configurationId} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{link.configurationName ?? link.configurationId}</td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={link.upload === true}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((item) =>
                              item.configurationId === link.configurationId
                                ? { ...item, upload: e.target.checked, notify: true }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={link.remove === true}
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((item) =>
                              item.configurationId === link.configurationId
                                ? { ...item, remove: e.target.checked, notify: true }
                                : item
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={updateMutation.isPending || !file?.id}
            onClick={() => void handleSave()}
          >
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
