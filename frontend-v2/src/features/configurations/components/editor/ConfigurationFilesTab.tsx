import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ConfigurationFileDialog } from '@/features/configurations/components/editor/ConfigurationFileDialog'
import type { Configuration } from '@/features/configurations/types/configuration'
import type { ConfigurationFileEntry } from '@/features/configurations/types/configuration'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'

interface ConfigurationFilesTabProps {
  draft: Configuration
  onChange: (patch: Partial<Configuration>) => void
}

function fileRowKey(file: ConfigurationFileEntry, index: number): string {
  return String(file.id ?? file.tempId ?? file.fileId ?? index)
}

export function ConfigurationFilesTab({ draft, onChange }: ConfigurationFilesTabProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFile, setEditingFile] = useState<ConfigurationFileEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConfigurationFileEntry | null>(null)

  const files = draft.files ?? []

  const visibleFiles = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    if (!query) {
      return files
    }
    return files.filter(
      (file) =>
        (file.description ?? '').toLowerCase().includes(query) ||
        (file.path ?? '').toLowerCase().includes(query) ||
        (file.url ?? '').toLowerCase().includes(query)
    )
  }, [files, searchText])

  const updateFiles = (next: ConfigurationFileEntry[]) => onChange({ files: next })

  const handleSaveFile = (file: ConfigurationFileEntry) => {
    const index = files.findIndex((item) => {
      if (file.id && item.id) {
        return item.id === file.id
      }
      if (file.tempId && item.tempId) {
        return item.tempId === file.tempId
      }
      if (file.fileId && item.fileId) {
        return item.fileId === file.fileId && item.tempId === file.tempId
      }
      return false
    })

    if (index >= 0) {
      const next = [...files]
      next[index] = file
      updateFiles(next)
    } else {
      updateFiles([...files, file])
    }
  }

  const handleDelete = () => {
    if (!deleteTarget) {
      return
    }

    updateFiles(
      files.filter((item) => {
        if (deleteTarget.id && item.id) {
          return item.id !== deleteTarget.id
        }
        if (deleteTarget.tempId && item.tempId) {
          return item.tempId !== deleteTarget.tempId
        }
        return true
      })
    )
    setDeleteTarget(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('configurations.editor.filesTitle')}</CardTitle>
        <CardDescription>{t('configurations.editor.filesDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="default-file-path">{t('configurations.editor.files.defaultPath')}</Label>
          <Input
            id="default-file-path"
            value={draft.defaultFilePath ?? ''}
            onChange={(e) => onChange({ defaultFilePath: e.target.value || undefined })}
            placeholder="/Download/"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t('configurations.editor.files.searchPlaceholder')}
            className="flex-1"
          />
          <Button
            type="button"
            className="shrink-0"
            onClick={() => {
              setEditingFile(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="mr-1 size-4" />
            {t('common.add')}
          </Button>
        </div>

        {visibleFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('configurations.editor.noFiles')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileDescription')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileDevicePath')}</th>
                  <th className="px-4 py-3 font-medium">{t('configurations.editor.fileUrl')}</th>
                  <th className="px-4 py-3 font-medium text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((file, index) => (
                  <tr key={fileRowKey(file, index)} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{file.description ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{file.path ?? file.filePath ?? '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">
                      {file.url ?? file.externalUrl ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingFile(file)
                            setDialogOpen(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(file)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <ConfigurationFileDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        configFile={editingFile}
        existingFiles={files}
        defaultFilePath={draft.defaultFilePath ?? '/Download/'}
        onSave={handleSaveFile}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('configurations.editor.files.deleteTitle')}
        description={t('configurations.editor.files.deleteConfirm', {
          name: deleteTarget?.description ?? deleteTarget?.path ?? '',
        })}
        onConfirm={handleDelete}
      />
    </Card>
  )
}
