import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { PowerShellScriptFormSheet } from '@/features/windows/scripts/components/PowerShellScriptFormSheet'
import {
  useDeletePowerShellScriptMutation,
  usePowerShellScriptsQuery,
} from '@/features/windows/scripts/hooks/use-windows-scripts'
import type { PowerShellScript } from '@/features/windows/scripts/types/powershell-script'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConfirmDeleteDialog } from '@/shared/components/ConfirmDeleteDialog'
import { usePermissions } from '@/features/auth/hooks/use-permissions'
import { toast } from 'sonner'

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

export function WindowsScriptsPage() {
  const { t } = useTranslation()
  const { canMutate, canDeleteCritical } = usePermissions()
  const { data, isLoading, error, refetch } = usePowerShellScriptsQuery()
  const deleteMutation = useDeletePowerShellScriptMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PowerShellScript | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PowerShellScript | null>(null)

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success(t('windowsScripts.delete.success'))
      setDeleteTarget(null)
    } catch {
      toast.error(t('windowsScripts.delete.error'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('windowsScripts.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('windowsScripts.description')}</p>
        </div>
        {canMutate && (
          <Button
            type="button"
            onClick={() => {
              setEditTarget(null)
              setFormOpen(true)
            }}
          >
            <Plus className="size-4" />
            {t('windowsScripts.create')}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : error ? (
            <div className="space-y-3 py-12 text-center">
              <p className="text-sm text-destructive">{t('windowsScripts.loadError')}</p>
              <Button type="button" variant="outline" onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : !data?.length ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t('windowsScripts.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-4 py-3 font-medium">{t('windowsScripts.columns.name')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsScripts.columns.description')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsScripts.columns.context')}</th>
                    <th className="px-4 py-3 font-medium">{t('windowsScripts.columns.updated')}</th>
                    {canMutate && <th className="px-4 py-3 font-medium" />}
                  </tr>
                </thead>
                <tbody>
                  {data.map((script) => (
                    <tr key={script.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{script.name}</td>
                      <td className="max-w-md px-4 py-3 text-muted-foreground">{script.description || '—'}</td>
                      <td className="px-4 py-3">
                        {script.executionContext === 'User'
                          ? t('windowsScripts.form.contextUser')
                          : t('windowsScripts.form.contextSystem')}
                      </td>
                      <td className="px-4 py-3">{formatTimestamp(script.updatedAt)}</td>
                      {canMutate && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t('common.edit')}
                              onClick={() => {
                                setEditTarget(script)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {canDeleteCritical && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive"
                                aria-label={t('common.delete')}
                                onClick={() => setDeleteTarget(script)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PowerShellScriptFormSheet
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditTarget(null)
          }
        }}
        script={editTarget}
      />

      <ConfirmDeleteDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={t('windowsScripts.delete.title')}
        description={t('windowsScripts.delete.confirm', { name: deleteTarget?.name ?? '' })}
        isPending={deleteMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
